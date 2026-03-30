import { Test, TestingModule } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { IngestionService } from '../ingestion/ingestion.service';

const mockPrisma: any = {
  source: {
    findMany: jest.fn(),
  },
  signal: {
    groupBy: jest.fn(),
  },
};

describe('SourcesService', () => {
  let service: SourcesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: {} },
        { provide: IngestionService, useValue: {} },
      ],
    }).compile();

    service = module.get(SourcesService);
  });

  it('adds health summaries to each source based on recent signal performance', async () => {
    mockPrisma.source.findMany.mockResolvedValue([
      {
        id: 'src_1',
        name: 'HN buyer intent',
        type: 'HN_SEARCH',
        status: 'ACTIVE',
        config: {},
        lastFetchedAt: new Date(),
        errorMessage: null,
        _count: { signals: 12 },
      },
      {
        id: 'src_2',
        name: 'Cold web search',
        type: 'WEB_SEARCH',
        status: 'ACTIVE',
        config: {},
        lastFetchedAt: null,
        errorMessage: null,
        _count: { signals: 1 },
      },
    ]);

    mockPrisma.signal.groupBy
      .mockResolvedValueOnce([
        { sourceId: 'src_1', _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([
        { sourceId: 'src_1', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { sourceId: 'src_1', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { sourceId: 'src_1', _count: { _all: 4 } },
      ]);

    const result = await service.findAll('org_1');

    expect(result[0].health).toEqual(expect.objectContaining({
      label: 'Strong',
      last7dSignals: 5,
      highConfidenceSignals: 3,
      pipelineSignals: 2,
      savedSignals: 4,
    }));
    expect(result[1].health).toEqual(expect.objectContaining({
      label: 'Stale',
      last7dSignals: 0,
      highConfidenceSignals: 0,
    }));
  });
});
