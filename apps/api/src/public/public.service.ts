import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async getLandingData() {
    const org = await this.prisma.organization.findFirst({
      where: {
        signals: { some: {} },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!org) {
      return {
        stats: { activeSources: 0, trackedKeywords: 0, highConfidenceSignals: 0, activeAlerts: 0 },
        signals: [],
      };
    }

    const [activeSources, trackedKeywords, highConfidenceSignals, activeAlerts, signals] = await Promise.all([
      this.prisma.source.count({ where: { organizationId: org.id, status: 'ACTIVE' } }),
      this.prisma.keyword.count({ where: { organizationId: org.id, isActive: true } }),
      this.prisma.signal.count({ where: { organizationId: org.id, confidenceScore: { gte: 80 } } }),
      this.prisma.alertRule.count({ where: { organizationId: org.id, isActive: true } }),
      this.prisma.signal.findMany({
        where: { organizationId: org.id },
        orderBy: [{ confidenceScore: 'desc' }, { fetchedAt: 'desc' }],
        take: 6,
        include: { source: { select: { name: true } } },
      }),
    ]);

    return {
      stats: { activeSources, trackedKeywords, highConfidenceSignals, activeAlerts },
      signals: signals.map((signal) => ({
        id: signal.id,
        score: signal.confidenceScore ?? 0,
        category: signal.category ?? 'OTHER',
        source: signal.source?.name ?? 'Unknown source',
        title: signal.originalTitle || signal.originalText.slice(0, 120),
        status: signal.status,
      })),
    };
  }
}
