// src/signals/signals.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignalStatus, SignalCategory, SignalStage, Prisma, AuditAction } from '@prisma/client';
import { getSourceProfile } from '../sources/source-profiles';

export interface SignalFilters {
  status?: SignalStatus;
  stage?: SignalStage;
  category?: SignalCategory;
  minConfidence?: number;
  sourceId?: string;
  keywordId?: string;
  assigneeId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

type SignalForRanking = {
  confidenceScore: number | null;
  category: SignalCategory | null;
  fetchedAt: Date;
  publishedAt: Date | null;
  status: SignalStatus;
  originalTitle?: string | null;
  originalText?: string | null;
  sourceUrl?: string;
  whyItMatters?: string | null;
  classificationRaw?: any;
  source?: { type?: string | null } | null;
  keywords?: Array<unknown>;
};

export interface UpdateSignalWorkflowInput {
  stage?: SignalStage;
  assigneeId?: string | null;
  nextStep?: string | null;
}

@Injectable()
export class SignalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string, filters: SignalFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const candidateLimit = Math.min(300, Math.max(limit * 4, page * limit * 2));

    const where: Prisma.SignalWhereInput = {
      organizationId: orgId,
      ...(filters.status && { status: filters.status }),
      ...(filters.stage && { stage: filters.stage }),
      ...(filters.category && { category: filters.category }),
      ...(filters.minConfidence !== undefined && { confidenceScore: { gte: filters.minConfidence } }),
      ...(filters.sourceId && { sourceId: filters.sourceId }),
      ...(filters.keywordId && { keywords: { some: { keywordId: filters.keywordId } } }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.search && {
        OR: [
          { originalTitle: { contains: filters.search, mode: 'insensitive' } },
          { originalText: { contains: filters.search, mode: 'insensitive' } },
          { normalizedText: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.dateFrom || filters.dateTo) && {
        fetchedAt: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        take: candidateLimit,
        orderBy: [{ fetchedAt: 'desc' }, { confidenceScore: 'desc' }],
        include: {
          source: { select: { id: true, name: true, type: true } },
          keywords: { include: { keyword: { select: { id: true, phrase: true } } } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { annotations: true } },
        },
      }),
      this.prisma.signal.count({ where }),
    ]);

    const rankedData = data
      .map((signal) => this.enrichSignal(signal))
      .sort((left, right) => {
        const scoreDiff = (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(right.fetchedAt).getTime() - new Date(left.fetchedAt).getTime();
      });
    const skip = (page - 1) * limit;

    return {
      data: rankedData.slice(skip, skip + limit),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(orgId: string, id: string) {
    const signal = await this.prisma.signal.findFirst({
      where: { id, organizationId: orgId },
      include: {
        source: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        keywords: { include: { keyword: true } },
        annotations: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!signal) throw new NotFoundException('Signal not found');
    return this.enrichSignal(signal);
  }

  async updateStatus(orgId: string, id: string, userId: string, status: SignalStatus) {
    const signal = await this.prisma.signal.findFirst({ where: { id, organizationId: orgId } });
    if (!signal) throw new NotFoundException('Signal not found');

    const actionMap: Partial<Record<SignalStatus, AuditAction>> = {
      SAVED: 'SIGNAL_SAVED',
      IGNORED: 'SIGNAL_IGNORED',
      BOOKMARKED: 'SIGNAL_BOOKMARKED',
    };

    const updatePromise = this.prisma.signal.update({
      where: { id },
      data: {
        status,
        ...(status === 'IGNORED'
          ? { stage: 'ARCHIVED', closedAt: new Date() }
          : status === 'NEW'
            ? { stage: 'TO_REVIEW', assigneeId: null, nextStep: null, closedAt: null }
            : {}),
      },
    });

    const auditPromise = actionMap[status]
      ? this.prisma.auditLog.create({
          data: { organizationId: orgId, userId, action: actionMap[status]!, metadata: { signalId: id } },
        })
      : Promise.resolve(null);

    const [updated] = await Promise.all([updatePromise, auditPromise]);
    return updated;
  }

  async updateWorkflow(orgId: string, id: string, userId: string, input: UpdateSignalWorkflowInput) {
    const signal = await this.prisma.signal.findFirst({ where: { id, organizationId: orgId } });
    if (!signal) throw new NotFoundException('Signal not found');

    if (input.assigneeId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { organizationId: orgId, userId: input.assigneeId },
        select: { id: true },
      });
      if (!member) throw new ForbiddenException('Assignee must belong to this workspace');
    }

    const nextStage = input.stage ?? signal.stage;
    const data: Prisma.SignalUpdateInput = {
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
      ...(input.nextStep !== undefined ? { nextStep: input.nextStep?.trim() || null } : {}),
      ...(nextStage === 'WON' || nextStage === 'LOST' || nextStage === 'ARCHIVED'
        ? { closedAt: signal.closedAt ?? new Date() }
        : { closedAt: null }),
      ...(input.stage && input.stage !== 'TO_REVIEW' && signal.status === 'NEW' ? { status: 'SAVED' } : {}),
    };

    const [updated] = await Promise.all([
      this.prisma.signal.update({
        where: { id },
        data,
        include: {
          source: { select: { id: true, name: true, type: true } },
          keywords: { include: { keyword: { select: { id: true, phrase: true } } } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { annotations: true } },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'SIGNAL_WORKFLOW_UPDATED',
          metadata: {
            signalId: id,
            stage: input.stage ?? undefined,
            assigneeId: input.assigneeId ?? undefined,
            nextStep: input.nextStep ?? undefined,
          },
        },
      }),
    ]);

    return updated;
  }

  async addAnnotation(orgId: string, signalId: string, userId: string, note: string) {
    const signal = await this.prisma.signal.findFirst({ where: { id: signalId, organizationId: orgId } });
    if (!signal) throw new NotFoundException('Signal not found');

    return this.prisma.signalAnnotation.create({
      data: { signalId, userId, note },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async getStats(orgId: string) {
    const [total, byCategory, byStatus, byStage, highConfidence, recent] = await Promise.all([
      this.prisma.signal.count({ where: { organizationId: orgId } }),
      this.prisma.signal.groupBy({
        by: ['category'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.signal.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.signal.groupBy({
        by: ['stage'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.signal.count({
        where: { organizationId: orgId, confidenceScore: { gte: 80 }, stage: { in: ['TO_REVIEW', 'IN_PROGRESS', 'OUTREACH', 'QUALIFIED'] } },
      }),
      this.prisma.signal.count({
        where: {
          organizationId: orgId,
          fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { total, byCategory, byStatus, byStage, highConfidence, recent };
  }

  private enrichSignal<T extends SignalForRanking>(signal: T) {
    const priorityScore = this.calculatePriorityScore(signal);
    const sourceProfile = signal.source?.type ? getSourceProfile(signal.source.type as any) : null;
    const classification = signal.classificationRaw || {};
    const postedAt = signal.publishedAt || signal.fetchedAt;
    return {
      ...signal,
      priorityScore,
      rankingReasons: this.buildRankingReasons(signal, priorityScore),
      freshnessLabel: this.getFreshnessLabel(signal.fetchedAt, signal.publishedAt),
      postedAgo: this.getRelativeAgeLabel(postedAt),
      sourceLabel: signal.source?.type ? sourceProfile?.platformLabel || signal.source.type : 'Unknown source',
      sourceProfile,
      painPoint: classification.painPoint || signal.whyItMatters || null,
      urgency: classification.urgency || 'MEDIUM',
      sentiment: classification.sentiment || 'NEUTRAL',
      conversationType: classification.conversationType || 'OTHER',
      suggestedReply: classification.suggestedReply || null,
    };
  }

  private calculatePriorityScore(signal: SignalForRanking) {
    const confidence = signal.confidenceScore ?? 0;
    const keywordCount = signal.keywords?.length ?? 0;
    const combinedText = this.buildRankingText(signal);
    const recommendationBoost = /recommend|who should we hire|looking for (a|an)?\s?(consultant|agency|partner)|implementation partner/i.test(combinedText) ? 6 : 0;
    const urgentBoost = /urgent|asap|blocked|need help now|immediately|this week|stuck|incident|production issue/i.test(combinedText) ? 5 : 0;
    const migrationBoost = /migration|migrate|implementation|integration|rollout|cutover/i.test(combinedText) ? 4 : 0;
    const hoursOld = Math.max(
      0,
      (Date.now() - new Date(signal.publishedAt || signal.fetchedAt).getTime()) / (1000 * 60 * 60),
    );
    const freshnessBoost = hoursOld <= 6 ? 18 : hoursOld <= 24 ? 12 : hoursOld <= 72 ? 7 : hoursOld <= 168 ? 3 : 0;
    const keywordBoost = Math.min(12, keywordCount * 4);
    const categoryBoost: Partial<Record<SignalCategory, number>> = {
      BUYING_INTENT: 12,
      RECOMMENDATION_REQUEST: 10,
      PAIN_COMPLAINT: 8,
      HIRING_SIGNAL: 7,
      PARTNERSHIP_INQUIRY: 6,
      MARKET_TREND: 4,
      OTHER: 0,
    };
    const sourceBoost: Partial<Record<string, number>> = {
      REDDIT: 5,
      REDDIT_SEARCH: 4,
      HN_SEARCH: 5,
      DISCOURSE: 4,
      GITHUB_SEARCH: 3,
      STACKOVERFLOW_SEARCH: 3,
      WEB_SEARCH: 1,
      RSS: 2,
      MANUAL: 2,
      TWITTER: 1,
    };
    const statusAdjustment = signal.status === 'NEW' ? 4 : signal.status === 'SAVED' ? 2 : 0;

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          confidence * 0.65 +
          freshnessBoost +
          keywordBoost +
          recommendationBoost +
          urgentBoost +
          migrationBoost +
          (categoryBoost[signal.category || SignalCategory.OTHER] ?? 0) +
          (sourceBoost[signal.source?.type || ''] ?? 0) +
          statusAdjustment,
        ),
      ),
    );
  }

  private buildRankingReasons(
    signal: SignalForRanking,
    priorityScore: number,
  ) {
    const reasons: string[] = [];
    const keywordCount = signal.keywords?.length ?? 0;
    const combinedText = this.buildRankingText(signal);
    const ageHours = Math.max(
      0,
      (Date.now() - new Date(signal.publishedAt || signal.fetchedAt).getTime()) / (1000 * 60 * 60),
    );

    if (signal.category === SignalCategory.BUYING_INTENT) {
      reasons.push('Clear buying-intent category');
    } else if (signal.category === SignalCategory.RECOMMENDATION_REQUEST) {
      reasons.push('Active recommendation request');
    } else if (signal.category === SignalCategory.PAIN_COMPLAINT) {
      reasons.push('Explicit pain/problem discussion');
    }

    if (/recommend|who should we hire|looking for (a|an)?\s?(consultant|agency|partner)|implementation partner/i.test(combinedText)) {
      reasons.push('Explicit recommendation or partner search');
    }

    if (/migration|migrate|implementation|integration|rollout|cutover/i.test(combinedText)) {
      reasons.push('Implementation or migration pain');
    }

    if ((signal.confidenceScore ?? 0) >= 85) {
      reasons.push('Very high intent score');
    } else if ((signal.confidenceScore ?? 0) >= 70) {
      reasons.push('Strong confidence signal');
    }

    if (keywordCount >= 3) {
      reasons.push(`Matched ${keywordCount} tracked keywords`);
    } else if (keywordCount > 0) {
      reasons.push(`Matched ${keywordCount} tracked keyword${keywordCount === 1 ? '' : 's'}`);
    }

    if (signal.source?.type === 'REDDIT' || signal.source?.type === 'HN_SEARCH') {
      reasons.push(`High-signal ${signal.source.type === 'REDDIT' ? 'community' : 'founder'} source`);
    }

    if (signal.classificationRaw?.urgency === 'HIGH' || signal.classificationRaw?.urgency === 'CRITICAL') {
      reasons.push('Urgent buyer conversation');
    }

    if (ageHours <= 24) {
      reasons.push('Fresh opportunity');
    } else if (ageHours <= 72) {
      reasons.push('Still recent');
    }

    if (priorityScore >= 90) {
      reasons.unshift('Top priority lead');
    }

    return reasons.slice(0, 4);
  }

  private buildRankingText(signal: SignalForRanking) {
    return [
      signal.originalTitle,
      signal.originalText,
      signal.whyItMatters,
      signal.classificationRaw?.painPoint,
      signal.classificationRaw?.conversationType,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private getFreshnessLabel(fetchedAt: Date, publishedAt: Date | null) {
    const ageHours = Math.max(
      0,
      (Date.now() - new Date(publishedAt || fetchedAt).getTime()) / (1000 * 60 * 60),
    );

    if (ageHours <= 6) return 'Hot';
    if (ageHours <= 24) return 'Fresh';
    if (ageHours <= 72) return 'Recent';
    return 'Aged';
  }

  private getRelativeAgeLabel(date: Date) {
    const diffMs = Math.max(0, Date.now() - new Date(date).getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
