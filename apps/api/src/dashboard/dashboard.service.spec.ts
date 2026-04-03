import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  signal: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
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
      .mockResolvedValueOnce(1);

    mockPrisma.signal.groupBy
      .mockResolvedValueOnce([{ category: 'BUYING_INTENT', _count: { _all: 7 } }])
      .mockResolvedValueOnce([{ stage: 'IN_PROGRESS', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ sourceId: 'src_1', _count: { _all: 5 } }]);

    mockPrisma.signal.findMany.mockResolvedValue([
      { id: 'sig_1', confidenceScore: 91, source: { name: 'r/startups', type: 'REDDIT' }, assignee: null },
    ]);
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
    expect(result.activation).toEqual(expect.objectContaining({
      completedSteps: 5,
      totalSteps: 5,
      progressPercent: 100,
    }));
    expect(result.byStage).toEqual([{ stage: 'IN_PROGRESS', count: 3 }]);
    expect(result.topSources).toEqual([{ source: { id: 'src_1', name: 'r/startups', type: 'REDDIT' }, count: 5 }]);
  });
});
