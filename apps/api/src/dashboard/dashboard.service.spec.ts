import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  signal: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  source: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  keyword: {
    count: jest.fn(),
  },
  alertRule: {
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('returns stage-based pipeline metrics from real backend aggregates', async () => {
    mockPrisma.signal.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);

    mockPrisma.signal.groupBy
      .mockResolvedValueOnce([{ category: 'BUYING_INTENT', _count: { _all: 7 } }])
      .mockResolvedValueOnce([{ stage: 'IN_PROGRESS', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ sourceId: 'src_1', _count: { _all: 5 } }]);

    mockPrisma.signal.findMany
      .mockResolvedValueOnce([
        { id: 'sig_1', confidenceScore: 91, source: { name: 'r/startups', type: 'REDDIT' }, assignee: null },
      ])
      .mockResolvedValueOnce([
        {
          fetchedAt: new Date('2026-04-01T08:00:00.000Z'),
          firstResponseAt: new Date('2026-04-01T10:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          sourceId: 'src_1',
          firstResponseAt: new Date('2026-04-02T11:00:00.000Z'),
          meetingBookedAt: new Date('2026-04-03T12:00:00.000Z'),
          pipelineValueUsd: 900,
        },
      ]);
    mockPrisma.signal.aggregate
      .mockResolvedValueOnce({ _sum: { estimatedHoursSaved: 7 } })
      .mockResolvedValueOnce({ _sum: { pipelineValueUsd: 4200 } })
      .mockResolvedValueOnce({ _sum: { pipelineValueUsd: 1800 } });
    mockPrisma.source.count.mockResolvedValue(1);
    mockPrisma.keyword.count.mockResolvedValue(4);
    mockPrisma.source.findMany.mockResolvedValue([{ id: 'src_1', name: 'r/startups', type: 'REDDIT' }]);
    mockPrisma.alertRule.count.mockResolvedValue(2);
    mockPrisma.$queryRaw.mockResolvedValue([{ date: '2026-03-26', count: BigInt(5) }]);

    const result = await service.getSummary('org_1');

    expect(result.stats).toEqual(expect.objectContaining({
      totalSignals: 20,
      inProgress: 3,
      outreach: 2,
      qualified: 1,
      won: 1,
      activeSources: 1,
      activeKeywords: 4,
      activeAlerts: 2,
    }));
    expect(result.roi).toEqual(expect.objectContaining({
      repliesThisWeek: 2,
      meetingsThisWeek: 1,
      estimatedHoursSavedThisWeek: 7,
      activePipelineValueUsd: 4200,
      wonValueThisQuarterUsd: 1800,
      avgResponseHours: 2,
      trackedSignals: 5,
      sourceOutcomes30d: [
        expect.objectContaining({
          source: { id: 'src_1', name: 'r/startups', type: 'REDDIT' },
          replies: 1,
          meetings: 1,
          trackedSignals: 1,
          pipelineValueUsd: 900,
        }),
      ],
    }));
    expect(result.activation).toEqual(expect.objectContaining({
      completedSteps: 5,
      totalSteps: 5,
      progressPercent: 100,
    }));
    expect(result.byStage).toEqual([{ stage: 'IN_PROGRESS', count: 3 }]);
    expect(result.topSources).toEqual([{ source: { id: 'src_1', name: 'r/startups', type: 'REDDIT' }, count: 5 }]);
  });
});
