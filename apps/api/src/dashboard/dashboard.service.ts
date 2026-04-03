import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(orgId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

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
    ]);

    // Resolve source names
    const sourceIds = topSources.map((s) => s.sourceId);
    const sources = await this.prisma.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true, type: true },
    });
    const sourceMap = Object.fromEntries(sources.map((s) => [s.id, s]));

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
