// sources.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SourceType, SourceStatus } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { getSourceProfile } from './source-profiles';
import { ClassificationService, type SourceSuggestionPack } from '../classification/classification.service';
import { createHash } from 'crypto';

@Injectable()
export class SourcesService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
    private ingestion: IngestionService,
    private classification: ClassificationService,
  ) {}

  async findAll(orgId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sources = await this.prisma.source.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { signals: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const [recentSignals, highConfidenceSignals, pipelineSignals, savedSignals] = await Promise.all([
      this.prisma.signal.groupBy({
        by: ['sourceId'],
        where: { organizationId: orgId, fetchedAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
      }),
      this.prisma.signal.groupBy({
        by: ['sourceId'],
        where: {
          organizationId: orgId,
          fetchedAt: { gte: thirtyDaysAgo },
          confidenceScore: { gte: 80 },
          stage: { in: ['TO_REVIEW', 'IN_PROGRESS', 'OUTREACH', 'QUALIFIED'] },
        },
        _count: { _all: true },
      }),
      this.prisma.signal.groupBy({
        by: ['sourceId'],
        where: {
          organizationId: orgId,
          stage: { in: ['IN_PROGRESS', 'OUTREACH', 'QUALIFIED', 'WON'] },
        },
        _count: { _all: true },
      }),
      this.prisma.signal.groupBy({
        by: ['sourceId'],
        where: {
          organizationId: orgId,
          status: 'SAVED',
        },
        _count: { _all: true },
      }),
    ]);

    const recentMap = new Map(recentSignals.map((item) => [item.sourceId, item._count._all]));
    const highConfidenceMap = new Map(highConfidenceSignals.map((item) => [item.sourceId, item._count._all]));
    const pipelineMap = new Map(pipelineSignals.map((item) => [item.sourceId, item._count._all]));
    const savedMap = new Map(savedSignals.map((item) => [item.sourceId, item._count._all]));

    return sources.map((source) => {
      const last7dSignals = recentMap.get(source.id) ?? 0;
      const highConfidenceCount = highConfidenceMap.get(source.id) ?? 0;
      const pipelineCount = pipelineMap.get(source.id) ?? 0;
      const savedCount = savedMap.get(source.id) ?? 0;
      const healthScore = this.calculateHealthScore({
        totalSignals: source._count?.signals ?? 0,
        last7dSignals,
        highConfidenceCount,
        pipelineCount,
        savedCount,
        status: source.status,
      });

      return {
        ...source,
        errorMessage: this.toSafeSourceError(source.errorMessage),
        sourceProfile: getSourceProfile(source.type),
        health: {
          score: healthScore,
          label: this.getHealthLabel(healthScore, source._count?.signals ?? 0, last7dSignals, source.status),
          last7dSignals,
          highConfidenceSignals: highConfidenceCount,
          pipelineSignals: pipelineCount,
          savedSignals: savedCount,
        },
      };
    });
  }

  async create(orgId: string, userId: string, data: {
    name: string; type: SourceType; config: Record<string, any>;
  }) {
    this.validateConfig(data.type, data.config);
    const existing = await this.prisma.source.findFirst({
      where: { organizationId: orgId, name: { equals: data.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Source name already exists');
    await this.entitlements.assertCanCreateSource(orgId);

    const [source] = await Promise.all([
      this.prisma.source.create({
        data: { organizationId: orgId, ...data, status: SourceStatus.ACTIVE },
      }),
    ]);
    await this.prisma.auditLog.create({
      data: { organizationId: orgId, userId, action: 'SOURCE_CREATED', metadata: { name: data.name } },
    });
    await this.ingestion.triggerManualFetch(orgId, source.id).catch(() => null);
    return source;
  }

  async update(orgId: string, id: string, data: Partial<{ name: string; status: SourceStatus; config: any }>) {
    const src = await this.prisma.source.findFirst({ where: { id, organizationId: orgId } });
    if (!src) throw new NotFoundException('Source not found');
    if (data.name && data.name.toLowerCase() !== src.name.toLowerCase()) {
      const existing = await this.prisma.source.findFirst({
        where: { organizationId: orgId, name: { equals: data.name, mode: 'insensitive' }, NOT: { id } },
      });
      if (existing) throw new ConflictException('Source name already exists');
    }
    if (data.config) {
      this.validateConfig(src.type, data.config);
    }
    const updated = await this.prisma.source.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === SourceStatus.ACTIVE ? { errorMessage: null } : {}),
      },
    });
    if (data.status === SourceStatus.ACTIVE && src.status !== SourceStatus.ACTIVE) {
      await this.ingestion.triggerManualFetch(orgId, id).catch(() => null);
    }
    return updated;
  }

  async remove(orgId: string, id: string, userId: string) {
    const src = await this.prisma.source.findFirst({ where: { id, organizationId: orgId } });
    if (!src) throw new NotFoundException('Source not found');
    await Promise.all([
      this.prisma.source.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'SOURCE_DELETED', metadata: { name: src.name } },
      }),
    ]);
    return { success: true };
  }

  async fetchNow(orgId: string, id: string, userId: string) {
    const source = await this.prisma.source.findFirst({ where: { id, organizationId: orgId } });
    if (!source) throw new NotFoundException('Source not found');

    await this.entitlements.assertCanFetchNow(orgId);
    await this.ingestion.triggerManualFetch(orgId, id);
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: 'SOURCE_UPDATED',
        metadata: { sourceId: id, name: source.name, trigger: 'manual_fetch' },
      },
    });

    return { queued: true };
  }

  async preview(orgId: string, data: {
    type: SourceType; config: Record<string, any>;
  }) {
    this.validateConfig(data.type, data.config);
    return this.ingestion.previewSource(orgId, data.type, data.config);
  }

  async getSuggestedTemplates(orgId: string, userId: string) {
    const [organization, user, keywords] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          businessFocus: true,
          targetAudience: true,
          negativeKeywords: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          accountType: true,
        },
      }),
      this.prisma.keyword.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 8,
        select: { phrase: true },
      }),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const context = {
      organizationName: organization.name,
      accountType: (user?.accountType || 'UNKNOWN') as 'FREELANCER' | 'BUSINESS' | 'UNKNOWN',
      businessFocus: organization.businessFocus,
      targetAudience: organization.targetAudience,
      trackedKeywords: keywords.map((keyword) => keyword.phrase.trim()).filter(Boolean),
      negativeKeywords: (organization.negativeKeywords || []).map((term) => term.trim()).filter(Boolean),
    };

    const profileHash = this.createSuggestionProfileHash(context);
    const cached = await this.prisma.sourceTemplateSuggestion.findMany({
      where: { organizationId: orgId, profileHash },
      orderBy: [{ rank: 'asc' }, { createdAt: 'desc' }],
    });

    if (cached.length) {
      return {
        source: 'cache',
        suggestions: cached.map((suggestion) => this.mapSuggestionRecord(suggestion)),
      };
    }

    const hasSparseContext = !organization.businessFocus && !organization.targetAudience && keywords.length === 0;
    if (hasSparseContext) {
      const similar = await this.prisma.sourceTemplateSuggestion.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      if (similar.length) {
        return {
          source: 'similar-cache',
          suggestions: similar
            .sort((left, right) => left.rank - right.rank)
            .map((suggestion) => this.mapSuggestionRecord(suggestion)),
        };
      }
    }

    const generated = await this.classification.generateSourceSuggestions(context);

    await this.prisma.sourceTemplateSuggestion.deleteMany({
      where: { organizationId: orgId, profileHash },
    });

    const created = await Promise.all(
      generated.map((suggestion, index) =>
        this.prisma.sourceTemplateSuggestion.create({
          data: {
            organizationId: orgId,
            profileHash,
            name: suggestion.name,
            audience: suggestion.audience,
            description: suggestion.description,
            recommendedKeywords: suggestion.recommendedKeywords,
            recommendedNegativeKeywords: suggestion.recommendedNegativeKeywords,
            sources: suggestion.sources,
            rank: index,
            generatedBy: 'ai',
          },
        }),
      ),
    );

    return {
      source: 'generated',
      suggestions: created.map((suggestion) => this.mapSuggestionRecord(suggestion)),
    };
  }

  async listSavedTemplates(orgId: string) {
    const templates = await this.prisma.savedSourceTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      templates: templates.map((template) => this.mapSavedTemplateRecord(template)),
    };
  }

  async createSavedTemplate(
    orgId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      audience?: string;
      sourceIds: string[];
      includeKeywords?: boolean;
      includeNegativeKeywords?: boolean;
    },
  ) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Template name is required');

    const sourceIds = Array.from(new Set((data.sourceIds || []).filter(Boolean)));
    if (sourceIds.length === 0) {
      throw new BadRequestException('Choose at least one source to save as a template');
    }

    const existing = await this.prisma.savedSourceTemplate.findFirst({
      where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('A saved template with this name already exists');

    const [organization, sources, keywords] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, negativeKeywords: true },
      }),
      this.prisma.source.findMany({
        where: { organizationId: orgId, id: { in: sourceIds } },
        orderBy: { createdAt: 'asc' },
      }),
      data.includeKeywords
        ? this.prisma.keyword.findMany({
            where: { organizationId: orgId, isActive: true },
            orderBy: { createdAt: 'asc' },
            take: 12,
            select: { phrase: true },
          })
        : Promise.resolve([]),
    ]);

    if (!organization) throw new NotFoundException('Organization not found');
    if (sources.length !== sourceIds.length) {
      throw new NotFoundException('One or more selected sources could not be found');
    }

    const template = await this.prisma.savedSourceTemplate.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        name,
        audience: data.audience?.trim() || `${organization.name} workspace template`,
        description:
          data.description?.trim() ||
          `Saved from ${sources.length} existing source${sources.length === 1 ? '' : 's'} in this workspace.`,
        recommendedKeywords: data.includeKeywords ? keywords.map((keyword) => keyword.phrase) : [],
        recommendedNegativeKeywords: data.includeNegativeKeywords ? organization.negativeKeywords || [] : [],
        sources: sources.map((source) => ({
          name: source.name,
          type: source.type,
          config: source.config,
        })),
      },
    });

    return this.mapSavedTemplateRecord(template);
  }

  validateConfig(type: SourceType, config: Record<string, any>) {
    if (config.excludeTerms !== undefined && (!Array.isArray(config.excludeTerms) || config.excludeTerms.some((term: unknown) => typeof term !== 'string'))) {
      throw new BadRequestException('Exclude terms must be an array of strings');
    }
    if (config.sourceWeight !== undefined) {
      const sourceWeight = Number(config.sourceWeight);
      if (!Number.isFinite(sourceWeight) || sourceWeight < 0.5 || sourceWeight > 1.5) {
        throw new BadRequestException('Source weight must be a number between 0.5 and 1.5');
      }
    }

    if (type === SourceType.REDDIT) {
      if (!config?.subreddit || typeof config.subreddit !== 'string') {
        throw new BadRequestException('Reddit sources require a subreddit name');
      }
    }
    if (type === SourceType.REDDIT_SEARCH) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('Reddit search sources require a search query');
      }
      if (config.subreddit && typeof config.subreddit !== 'string') {
        throw new BadRequestException('Reddit search subreddit must be a string');
      }
    }
    if (type === SourceType.RSS) {
      if (!config?.url || typeof config.url !== 'string' || !/^https?:\/\//.test(config.url)) {
        throw new BadRequestException('RSS sources require a valid feed URL');
      }
    }
    if (type === SourceType.DISCOURSE) {
      if (!config?.baseUrl || typeof config.baseUrl !== 'string' || !/^https?:\/\//.test(config.baseUrl)) {
        throw new BadRequestException('Discourse sources require a valid community URL');
      }
      if (config.query !== undefined && typeof config.query !== 'string') {
        throw new BadRequestException('Discourse query must be a string');
      }
      if (config.tags !== undefined && (!Array.isArray(config.tags) || config.tags.some((tag: unknown) => typeof tag !== 'string'))) {
        throw new BadRequestException('Discourse tags must be an array of strings');
      }
      if (config.postedWithinDays !== undefined) {
        const postedWithinDays = Number(config.postedWithinDays);
        if (!Number.isFinite(postedWithinDays) || postedWithinDays < 1 || postedWithinDays > 365) {
          throw new BadRequestException('Discourse posted-within window must be between 1 and 365 days');
        }
      }
    }
    if (type === SourceType.HN_SEARCH) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('Hacker News search sources require a search query');
      }
    }
    if (type === SourceType.GITHUB_SEARCH) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('GitHub search sources require a search query');
      }
      if (config.repo && typeof config.repo !== 'string') {
        throw new BadRequestException('GitHub repo filter must be a string');
      }
    }
    if (type === SourceType.STACKOVERFLOW_SEARCH) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('Stack Overflow search sources require a search query');
      }
      if (config.tags !== undefined && (!Array.isArray(config.tags) || config.tags.some((tag: unknown) => typeof tag !== 'string'))) {
        throw new BadRequestException('Stack Overflow tags must be an array of strings');
      }
    }
    if (type === SourceType.SAM_GOV) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('SAM.gov sources require a keyword query');
      }
      if (config.noticeTypes !== undefined && (!Array.isArray(config.noticeTypes) || config.noticeTypes.some((type: unknown) => typeof type !== 'string'))) {
        throw new BadRequestException('SAM.gov notice types must be an array of strings');
      }
      if (config.postedWithinDays !== undefined) {
        const postedWithinDays = Number(config.postedWithinDays);
        if (!Number.isFinite(postedWithinDays) || postedWithinDays < 1 || postedWithinDays > 365) {
          throw new BadRequestException('SAM.gov posted-within window must be between 1 and 365 days');
        }
      }
      if (config.naicsCode && typeof config.naicsCode !== 'string') {
        throw new BadRequestException('SAM.gov NAICS code must be a string');
      }
      if (config.agency && typeof config.agency !== 'string') {
        throw new BadRequestException('SAM.gov agency must be a string');
      }
    }
    if (type === SourceType.WEB_SEARCH) {
      if (!config?.query || typeof config.query !== 'string') {
        throw new BadRequestException('Web search sources require a search query');
      }
      if (config.domains !== undefined && (!Array.isArray(config.domains) || config.domains.some((domain: unknown) => typeof domain !== 'string'))) {
        throw new BadRequestException('Web search domains must be an array of hostnames');
      }
    }
  }

  private calculateHealthScore(input: {
    totalSignals: number;
    last7dSignals: number;
    highConfidenceCount: number;
    pipelineCount: number;
    savedCount: number;
    status: SourceStatus;
  }) {
    const score = Math.round(
      Math.min(20, input.totalSignals) * 1.5 +
      Math.min(8, input.last7dSignals) * 6 +
      Math.min(6, input.highConfidenceCount) * 9 +
      Math.min(6, input.pipelineCount) * 10 +
      Math.min(6, input.savedCount) * 5 -
      (input.status === SourceStatus.ERROR ? 15 : 0),
    );

    return Math.max(0, Math.min(100, score));
  }

  private getHealthLabel(score: number, totalSignals: number, last7dSignals: number, status: SourceStatus) {
    if (status === SourceStatus.ERROR) return 'Needs attention';
    if (totalSignals === 0) return 'Idle';
    if (score >= 75) return 'Strong';
    if (score >= 40) return last7dSignals > 0 ? 'Promising' : 'Stale';
    return last7dSignals > 0 ? 'Weak' : 'Stale';
  }

  private toSafeSourceError(message: string | null) {
    if (!message) return null;
    if (message.includes('organization.findUnique()')) return 'Workspace settings could not be loaded';
    if (message.includes('negativeKeywords')) return 'Workspace filters could not be loaded';
    return message;
  }

  private createSuggestionProfileHash(context: {
    organizationName: string;
    accountType: 'FREELANCER' | 'BUSINESS' | 'UNKNOWN';
    businessFocus?: string | null;
    targetAudience?: string | null;
    trackedKeywords: string[];
    negativeKeywords: string[];
  }) {
    return createHash('sha1')
      .update(
        JSON.stringify({
          organizationName: context.organizationName.trim().toLowerCase(),
          accountType: context.accountType,
          businessFocus: context.businessFocus?.trim().toLowerCase() || null,
          targetAudience: context.targetAudience?.trim().toLowerCase() || null,
          trackedKeywords: context.trackedKeywords.map((keyword) => keyword.trim().toLowerCase()).sort(),
          negativeKeywords: context.negativeKeywords.map((keyword) => keyword.trim().toLowerCase()).sort(),
        }),
      )
      .digest('hex');
  }

  private mapSuggestionRecord(suggestion: {
    id: string;
    name: string;
    audience: string;
    description: string;
    recommendedKeywords: string[];
    recommendedNegativeKeywords: string[];
    sources: unknown;
    rank: number;
    generatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SourceSuggestionPack & { id: string; rank: number; generatedBy: string | null; createdAt: Date; updatedAt: Date } {
    return {
      id: suggestion.id,
      name: suggestion.name,
      audience: suggestion.audience,
      description: suggestion.description,
      recommendedKeywords: suggestion.recommendedKeywords,
      recommendedNegativeKeywords: suggestion.recommendedNegativeKeywords,
      sources: Array.isArray(suggestion.sources) ? (suggestion.sources as SourceSuggestionPack['sources']) : [],
      rank: suggestion.rank,
      generatedBy: suggestion.generatedBy,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    };
  }

  private mapSavedTemplateRecord(template: {
    id: string;
    name: string;
    audience: string;
    description: string;
    recommendedKeywords: string[];
    recommendedNegativeKeywords: string[];
    sources: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: template.id,
      name: template.name,
      audience: template.audience,
      description: template.description,
      recommendedKeywords: template.recommendedKeywords,
      recommendedNegativeKeywords: template.recommendedNegativeKeywords,
      sources: Array.isArray(template.sources) ? (template.sources as SourceSuggestionPack['sources']) : [],
      rank: 0,
      generatedBy: 'workspace',
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
