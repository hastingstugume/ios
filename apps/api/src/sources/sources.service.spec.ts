import { Test, TestingModule } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { ClassificationService } from '../classification/classification.service';

const mockPrisma: any = {
  organization: {
    findUnique: jest.fn(),
  },
  source: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  savedSourceTemplate: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  sourceTemplateSuggestion: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  keyword: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  signal: {
    groupBy: jest.fn(),
  },
};

describe('SourcesService', () => {
  let service: SourcesService;
  const mockClassification = {
    generateSourceSuggestions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: {} },
        { provide: IngestionService, useValue: {} },
        { provide: ClassificationService, useValue: mockClassification },
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
        status: 'ERROR',
        config: {},
        lastFetchedAt: null,
        errorMessage: 'Invalid `this.prisma.organization.findUnique()` invocation in C:\\Users\\Hastings',
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
      label: 'Needs attention',
      last7dSignals: 0,
      highConfidenceSignals: 0,
    }));
    expect(result[1].errorMessage).toBe('Workspace settings could not be loaded');
  });

  it('reuses cached source suggestions for the same workspace profile', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org_1',
      name: 'Acme Growth Agency',
      businessFocus: 'AI automation',
      targetAudience: 'Operations leaders',
      negativeKeywords: ['job'],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ accountType: 'BUSINESS' });
    mockPrisma.keyword.findMany.mockResolvedValue([{ phrase: 'AI automation agency' }]);
    mockPrisma.sourceTemplateSuggestion.findMany.mockResolvedValue([
      {
        id: 'suggestion_1',
        name: 'Ops automation demand',
        audience: 'Ops leaders seeking outside help',
        description: 'Cached suggestion',
        recommendedKeywords: ['AI automation agency'],
        recommendedNegativeKeywords: ['job'],
        sources: [{ name: 'Reddit demand', type: 'REDDIT_SEARCH', config: { query: 'need automation consultant' } }],
        rank: 0,
        generatedBy: 'ai',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.getSuggestedTemplates('org_1', 'user_1');

    expect(result.source).toBe('cache');
    expect(result.suggestions).toHaveLength(1);
    expect(mockClassification.generateSourceSuggestions).not.toHaveBeenCalled();
  });

  it('creates a saved template from selected workspace sources', async () => {
    mockPrisma.savedSourceTemplate.findFirst.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme Growth Agency',
      negativeKeywords: ['job'],
    });
    mockPrisma.source.findMany.mockResolvedValue([
      {
        id: 'src_1',
        name: 'Reddit buyer intent',
        type: 'REDDIT_SEARCH',
        config: { query: 'need consultant' },
        createdAt: new Date(),
      },
      {
        id: 'src_2',
        name: 'Web buyer search',
        type: 'WEB_SEARCH',
        config: { query: 'recommend agency' },
        createdAt: new Date(),
      },
    ]);
    mockPrisma.keyword.findMany.mockResolvedValue([{ phrase: 'consultant' }]);
    mockPrisma.savedSourceTemplate.create.mockResolvedValue({
      id: 'template_1',
      name: 'My saved pack',
      audience: 'Acme Growth Agency workspace template',
      description: 'Saved from 2 existing sources in this workspace.',
      recommendedKeywords: ['consultant'],
      recommendedNegativeKeywords: ['job'],
      sources: [
        { name: 'Reddit buyer intent', type: 'REDDIT_SEARCH', config: { query: 'need consultant' } },
        { name: 'Web buyer search', type: 'WEB_SEARCH', config: { query: 'recommend agency' } },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createSavedTemplate('org_1', 'user_1', {
      name: 'My saved pack',
      sourceIds: ['src_1', 'src_2'],
      includeKeywords: true,
      includeNegativeKeywords: true,
    });

    expect(mockPrisma.savedSourceTemplate.create).toHaveBeenCalled();
    expect(result.name).toBe('My saved pack');
    expect(result.sources).toHaveLength(2);
  });
});
