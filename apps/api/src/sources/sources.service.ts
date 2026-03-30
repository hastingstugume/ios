// sources.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SourceType, SourceStatus } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { IngestionService } from '../ingestion/ingestion.service';

@Injectable()
export class SourcesService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
    private ingestion: IngestionService,
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
    return this.prisma.source.update({ where: { id }, data });
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

  async preview(orgId: string, data: {
    type: SourceType; config: Record<string, any>;
  }) {
    this.validateConfig(data.type, data.config);
    return this.ingestion.previewSource(orgId, data.type, data.config);
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
}
