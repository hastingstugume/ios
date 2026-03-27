// src/signals/signals.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignalStatus, SignalCategory, SignalStage, Prisma, AuditAction } from '@prisma/client';

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
    const skip = (page - 1) * limit;

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
        skip,
        take: limit,
        orderBy: [{ confidenceScore: 'desc' }, { fetchedAt: 'desc' }],
        include: {
          source: { select: { id: true, name: true, type: true } },
          keywords: { include: { keyword: { select: { id: true, phrase: true } } } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { annotations: true } },
        },
      }),
      this.prisma.signal.count({ where }),
    ]);

    return {
      data,
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
    return signal;
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
}
