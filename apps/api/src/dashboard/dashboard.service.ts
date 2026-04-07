import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(orgId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const [
      totalSignals,
      newToday,
      newThisWeek,
      highConfidence,
      saved,
      inProgress,
      outreach,
      qualified,
      won,
      sourceCount,
      activeKeywordCount,
      byCategory,
      byStage,
      topSources,
      recentHigh,
      alertRules,
      repliesThisWeek,
      meetingsThisWeek,
      hoursSavedThisWeekAgg,
      activePipelineValueAgg,
      wonValueThisQuarterAgg,
      responseLatencySamples,
      roiTrackedSignals,
      sourceOutcomeSignals30d,
    ] = await Promise.all([
      this.prisma.signal.count({ where: { organizationId: orgId } }),
      this.prisma.signal.count({ where: { organizationId: orgId, fetchedAt: { gte: oneDayAgo } } }),
      this.prisma.signal.count({ where: { organizationId: orgId, fetchedAt: { gte: sevenDaysAgo } } }),
      this.prisma.signal.count({
        where: {
          organizationId: orgId,
          confidenceScore: { gte: 80 },
          stage: { in: ['TO_REVIEW', 'IN_PROGRESS', 'OUTREACH', 'QUALIFIED'] },
        },
      }),
      this.prisma.signal.count({ where: { organizationId: orgId, status: 'SAVED' } }),
      this.prisma.signal.count({ where: { organizationId: orgId, stage: 'IN_PROGRESS' } }),
      this.prisma.signal.count({ where: { organizationId: orgId, stage: 'OUTREACH' } }),
      this.prisma.signal.count({ where: { organizationId: orgId, stage: 'QUALIFIED' } }),
      this.prisma.signal.count({ where: { organizationId: orgId, stage: 'WON' } }),
      this.prisma.source.count({ where: { organizationId: orgId } }),
      this.prisma.keyword.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.signal.groupBy({
        by: ['category'],
        where: { organizationId: orgId, fetchedAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      this.prisma.signal.groupBy({
        by: ['stage'],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { _count: { stage: 'desc' } },
      }),
      this.prisma.signal.groupBy({
        by: ['sourceId'],
        where: { organizationId: orgId, fetchedAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        orderBy: { _count: { sourceId: 'desc' } },
        take: 5,
      }),
      this.prisma.signal.findMany({
        where: {
          organizationId: orgId,
          confidenceScore: { gte: 80 },
          stage: { in: ['TO_REVIEW', 'IN_PROGRESS', 'OUTREACH', 'QUALIFIED'] },
        },
        orderBy: { fetchedAt: 'desc' },
        take: 5,
        include: {
          source: { select: { name: true, type: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.alertRule.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.signal.count({ where: { organizationId: orgId, firstResponseAt: { gte: sevenDaysAgo } } }),
      this.prisma.signal.count({ where: { organizationId: orgId, meetingBookedAt: { gte: sevenDaysAgo } } }),
      this.prisma.signal.aggregate({
        where: { organizationId: orgId, firstResponseAt: { gte: sevenDaysAgo } },
        _sum: { estimatedHoursSaved: true },
      }),
      this.prisma.signal.aggregate({
        where: {
          organizationId: orgId,
          stage: { in: ['IN_PROGRESS', 'OUTREACH', 'QUALIFIED'] },
        },
        _sum: { pipelineValueUsd: true },
      }),
      this.prisma.signal.aggregate({
        where: {
          organizationId: orgId,
          stage: 'WON',
          closedAt: { gte: quarterStart },
        },
        _sum: { pipelineValueUsd: true },
      }),
      this.prisma.signal.findMany({
        where: {
          organizationId: orgId,
          firstResponseAt: { not: null, gte: ninetyDaysAgo },
        },
        select: { fetchedAt: true, firstResponseAt: true },
        orderBy: { firstResponseAt: 'desc' },
        take: 400,
      }),
      this.prisma.signal.count({
        where: {
          organizationId: orgId,
          OR: [
            { firstResponseAt: { not: null } },
            { meetingBookedAt: { not: null } },
            { pipelineValueUsd: { not: null } },
            { estimatedHoursSaved: { not: null } },
          ],
        },
      }),
      this.prisma.signal.findMany({
        where: {
          organizationId: orgId,
          fetchedAt: { gte: thirtyDaysAgo },
          OR: [
            { firstResponseAt: { not: null } },
            { meetingBookedAt: { not: null } },
            { pipelineValueUsd: { not: null } },
          ],
        },
        select: {
          sourceId: true,
          firstResponseAt: true,
          meetingBookedAt: true,
          pipelineValueUsd: true,
        },
      }),
    ]);

    const responseHours = responseLatencySamples
      .map((signal) => {
        if (!signal.firstResponseAt) return null;
        const diffMs = signal.firstResponseAt.getTime() - signal.fetchedAt.getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return null;
        return diffMs / (1000 * 60 * 60);
      })
      .filter((value): value is number => value !== null);
    const avgResponseHours = responseHours.length
      ? Number((responseHours.reduce((sum, value) => sum + value, 0) / responseHours.length).toFixed(1))
      : null;

    // Resolve source names
    const sourceIds = Array.from(new Set([
      ...topSources.map((s) => s.sourceId),
      ...sourceOutcomeSignals30d.map((signal) => signal.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)),
    ]));
    const sources = await this.prisma.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true, type: true },
    });
    const sourceMap = Object.fromEntries(sources.map((s) => [s.id, s]));
    const sourceOutcomeMap = new Map<string, { replies: number; meetings: number; pipelineValueUsd: number; trackedSignals: number }>();
    for (const signal of sourceOutcomeSignals30d) {
      const sourceId = signal.sourceId;
      if (!sourceId) continue;
      const existing = sourceOutcomeMap.get(sourceId) || { replies: 0, meetings: 0, pipelineValueUsd: 0, trackedSignals: 0 };
      existing.trackedSignals += 1;
      if (signal.firstResponseAt) existing.replies += 1;
      if (signal.meetingBookedAt) existing.meetings += 1;
      if (signal.pipelineValueUsd) existing.pipelineValueUsd += signal.pipelineValueUsd;
      sourceOutcomeMap.set(sourceId, existing);
    }
    const sourceOutcomeRows = [...sourceOutcomeMap.entries()]
      .map(([sourceId, stats]) => ({
        source: sourceMap[sourceId] || { id: sourceId, name: 'Unknown source', type: 'UNKNOWN' },
        ...stats,
      }))
      .sort((left, right) =>
        (right.meetings - left.meetings)
        || (right.replies - left.replies)
        || (right.pipelineValueUsd - left.pipelineValueUsd)
        || (right.trackedSignals - left.trackedSignals),
      )
      .slice(0, 6);

    // 30-day daily trend
    const trend = await this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE_TRUNC('day', "fetchedAt")::date AS date, COUNT(*) AS count
      FROM "Signal"
      WHERE "organizationId" = ${orgId}
        AND "fetchedAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const activationItems = [
      {
        id: 'source_connected',
        label: 'Connect your first source',
        description: 'Turn on one source so the workspace can start capturing buyer intent.',
        href: '/sources',
        completed: sourceCount > 0,
      },
      {
        id: 'keywords_added',
        label: 'Add at least 3 keywords',
        description: 'Tight keywords improve relevance and reduce noisy opportunities.',
        href: '/keywords',
        completed: activeKeywordCount >= 3,
      },
      {
        id: 'first_signal_captured',
        label: 'Capture your first signal',
        description: 'Review one real opportunity from your feed to validate demand.',
        href: '/feed',
        completed: totalSignals > 0,
      },
      {
        id: 'first_signal_saved',
        label: 'Save your first signal',
        description: 'Save high-intent opportunities so the team can act quickly.',
        href: '/feed?status=SAVED',
        completed: saved > 0,
      },
      {
        id: 'alert_enabled',
        label: 'Enable an alert rule',
        description: 'Get notified as soon as high-intent signals show up.',
        href: '/alerts',
        completed: alertRules > 0,
      },
    ];

    const completedActivationSteps = activationItems.filter((item) => item.completed).length;

    return {
      stats: {
        totalSignals,
        newToday,
        newThisWeek,
        highConfidence,
        saved,
        inProgress,
        outreach,
        qualified,
        won,
        activeSources: sourceCount,
        activeKeywords: activeKeywordCount,
        activeAlerts: alertRules,
      },
      roi: {
        repliesThisWeek,
        meetingsThisWeek,
        estimatedHoursSavedThisWeek: hoursSavedThisWeekAgg._sum.estimatedHoursSaved ?? 0,
        activePipelineValueUsd: activePipelineValueAgg._sum.pipelineValueUsd ?? 0,
        wonValueThisQuarterUsd: wonValueThisQuarterAgg._sum.pipelineValueUsd ?? 0,
        avgResponseHours,
        trackedSignals: roiTrackedSignals,
        sourceOutcomes30d: sourceOutcomeRows,
      },
      activation: {
        completedSteps: completedActivationSteps,
        totalSteps: activationItems.length,
        progressPercent: Math.round((completedActivationSteps / activationItems.length) * 100),
        items: activationItems,
      },
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
      byStage: byStage.map((stage) => ({ stage: stage.stage, count: stage._count._all })),
      topSources: topSources.map((s) => ({
        source: sourceMap[s.sourceId],
        count: s._count._all,
      })),
      recentHigh,
      trend: trend.map((t) => ({ date: t.date, count: Number(t.count) })),
    };
  }
}
