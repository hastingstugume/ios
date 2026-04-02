import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  signal: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

describe('SignalsService', () => {
  let service: SignalsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SignalsService);
  });

  it('rejects assigning a signal to a user outside the workspace', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      organizationId: 'org_1',
      stage: 'TO_REVIEW',
      status: 'NEW',
      closedAt: null,
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkflow('org_1', 'sig_1', 'user_1', { assigneeId: 'user_2' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('promotes a new signal into the pipeline when a workflow stage is set', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      organizationId: 'org_1',
      stage: 'TO_REVIEW',
      status: 'NEW',
      closedAt: null,
    });
    mockPrisma.signal.update.mockResolvedValue({ id: 'sig_1', stage: 'IN_PROGRESS', status: 'SAVED' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log_1' });

    await service.updateWorkflow('org_1', 'sig_1', 'user_1', {
      stage: 'IN_PROGRESS',
      nextStep: 'Reach out to the buyer',
    });

    expect(mockPrisma.signal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sig_1' },
      data: expect.objectContaining({
        stage: 'IN_PROGRESS',
        status: 'SAVED',
        nextStep: 'Reach out to the buyer',
        closedAt: null,
      }),
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'SIGNAL_WORKFLOW_UPDATED',
      }),
    }));
  });

  it('clears workflow fields when resetting a signal back to NEW', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_2',
      organizationId: 'org_1',
      stage: 'OUTREACH',
      status: 'SAVED',
      closedAt: null,
    });
    mockPrisma.signal.update.mockResolvedValue({ id: 'sig_2', status: 'NEW', stage: 'TO_REVIEW' });

    await service.updateStatus('org_1', 'sig_2', 'user_1', 'NEW');

    expect(mockPrisma.signal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sig_2' },
      data: expect.objectContaining({
        status: 'NEW',
        stage: 'TO_REVIEW',
        assigneeId: null,
        nextStep: null,
        closedAt: null,
      }),
    }));
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('throws when updating workflow for an unknown signal', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkflow('org_1', 'missing', 'user_1', { stage: 'IN_PROGRESS' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('ranks fresher buying-intent signals ahead of older weaker ones', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'old_low',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://example.com/1',
        originalTitle: 'Older discussion',
        originalText: 'Need help eventually',
        normalizedText: 'Need help eventually',
        fetchedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        category: 'OTHER',
        confidenceScore: 58,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Web', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'help' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
      {
        id: 'fresh_high',
        organizationId: 'org_1',
        sourceId: 'src_2',
        externalId: 'ext_2',
        sourceUrl: 'https://example.com/2',
        originalTitle: 'Looking for an automation agency',
        originalText: 'We need an automation consultant this week',
        normalizedText: 'We need an automation consultant this week',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'BUYING_INTENT',
        confidenceScore: 82,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_2', name: 'HN', type: 'HN_SEARCH' },
        keywords: [
          { keyword: { id: 'kw_1', phrase: 'automation' } },
          { keyword: { id: 'kw_2', phrase: 'consultant' } },
        ],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(2);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].id).toBe('fresh_high');
    expect(result.data[0].priorityScore).toBeGreaterThan(result.data[1].priorityScore);
    expect(result.data[0].rankingReasons).toEqual(expect.arrayContaining([
      'Clear buying-intent category',
      'Strong confidence signal',
    ]));
  });

  it('boosts recommendation and migration language in ranking reasons and priority', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'generic_signal',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://example.com/1',
        originalTitle: 'General tooling question',
        originalText: 'We are exploring some tooling options.',
        normalizedText: 'We are exploring some tooling options.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'OTHER',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Web', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'tooling' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
      {
        id: 'migration_recommendation',
        organizationId: 'org_1',
        sourceId: 'src_2',
        externalId: 'ext_2',
        sourceUrl: 'https://example.com/2',
        originalTitle: 'Who should we hire for this migration?',
        originalText: 'We need an implementation partner immediately for a CRM migration rollout.',
        normalizedText: 'We need an implementation partner immediately for a CRM migration rollout.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'RECOMMENDATION_REQUEST',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_2', name: 'HN', type: 'HN_SEARCH' },
        keywords: [{ keyword: { id: 'kw_2', phrase: 'migration' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(2);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].id).toBe('migration_recommendation');
    expect(result.data[0].priorityScore).toBeGreaterThan(result.data[1].priorityScore);
    expect(result.data[0].rankingReasons).toEqual(expect.arrayContaining([
      'Active recommendation request',
      'Explicit recommendation or partner search',
      'Implementation or migration pain',
    ]));
  });

  it('extracts lightweight account, domain, and tool hints from signals', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'sig_hint',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://community.example.com/t/shopify-migration-help/12',
        originalTitle: 'Need help with a Shopify migration',
        originalText: 'We need implementation support for Shopify and Stripe before launch.',
        normalizedText: 'We need implementation support for Shopify and Stripe before launch.',
        fetchedAt: new Date(Date.now() - 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 60 * 60 * 1000),
        category: 'BUYING_INTENT',
        confidenceScore: 84,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Community', type: 'DISCOURSE' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'migration' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(1);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].linkedDomain).toBe('community.example.com');
    expect(result.data[0].accountHint).toBe('community.example.com');
    expect(result.data[0].toolHints).toEqual(expect.arrayContaining(['Shopify', 'Stripe']));
  });

  it('boosts funding and hiring trigger-event language without outranking direct buyer asks excessively', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'generic_signal',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://example.com/1',
        originalTitle: 'General operations update',
        originalText: 'We are sharing some internal updates.',
        normalizedText: 'We are sharing some internal updates.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'OTHER',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Web', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'growth' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
      {
        id: 'trigger_event',
        organizationId: 'org_1',
        sourceId: 'src_2',
        externalId: 'ext_2',
        sourceUrl: 'https://example.com/2',
        originalTitle: 'Startup raises seed round and is hiring a Head of Growth',
        originalText: 'The company just raised funding and is hiring for growth and implementation roles.',
        normalizedText: 'The company just raised funding and is hiring for growth and implementation roles.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'MARKET_TREND',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_2', name: 'RSS', type: 'RSS' },
        keywords: [{ keyword: { id: 'kw_2', phrase: 'growth' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(2);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].id).toBe('trigger_event');
    expect(result.data[0].rankingReasons).toEqual(expect.arrayContaining([
      'Trigger event suggests near-term demand',
    ]));
  });

  it('boosts local service recommendation demand and extracts service plus location hints', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'generic_signal',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://example.com/1',
        originalTitle: 'General neighborhood discussion',
        originalText: 'We are talking about home maintenance in general.',
        normalizedText: 'We are talking about home maintenance in general.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'OTHER',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Web', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'home services' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
      {
        id: 'service_recommendation',
        organizationId: 'org_1',
        sourceId: 'src_2',
        externalId: 'ext_2',
        sourceUrl: 'https://example.com/2',
        originalTitle: 'Looking for a cleaner in Kampala',
        originalText: 'Can anyone recommend a reliable cleaning service in Kampala this week? Need quotes ASAP.',
        normalizedText: 'Can anyone recommend a reliable cleaning service in Kampala this week? Need quotes ASAP.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'RECOMMENDATION_REQUEST',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_2', name: 'Community', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_2', phrase: 'cleaner' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(2);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].id).toBe('service_recommendation');
    expect(result.data[0].serviceHint).toBe('Cleaning service');
    expect(result.data[0].locationHint).toBe('Kampala');
    expect(result.data[0].rankingReasons).toEqual(expect.arrayContaining([
      'Direct service-provider demand',
      'Location-specific buying context',
    ]));
  });

  it('boosts ecommerce implementation demand and extracts ecommerce service hints', async () => {
    mockPrisma.signal.findMany.mockResolvedValue([
      {
        id: 'generic_signal',
        organizationId: 'org_1',
        sourceId: 'src_1',
        externalId: 'ext_1',
        sourceUrl: 'https://example.com/1',
        originalTitle: 'General store discussion',
        originalText: 'We are talking about ecommerce trends broadly.',
        normalizedText: 'We are talking about ecommerce trends broadly.',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'OTHER',
        confidenceScore: 70,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_1', name: 'Web', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_1', phrase: 'ecommerce' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
      {
        id: 'shopify_signal',
        organizationId: 'org_1',
        sourceId: 'src_2',
        externalId: 'ext_2',
        sourceUrl: 'https://community.shopify.com/c/store/need-shopify-help/2',
        originalTitle: 'Need a Shopify expert for migration',
        originalText: 'Can anyone recommend a Shopify agency for a storefront migration and merchant center issues?',
        normalizedText: 'Can anyone recommend a Shopify agency for a storefront migration and merchant center issues?',
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'RECOMMENDATION_REQUEST',
        confidenceScore: 72,
        whyItMatters: null,
        suggestedOutreach: null,
        status: 'NEW',
        stage: 'TO_REVIEW',
        source: { id: 'src_2', name: 'Shopify Community', type: 'WEB_SEARCH' },
        keywords: [{ keyword: { id: 'kw_2', phrase: 'shopify migration' } }],
        assignee: null,
        _count: { annotations: 0 },
      },
    ]);
    mockPrisma.signal.count.mockResolvedValue(2);

    const result = await service.findAll('org_1', { page: 1, limit: 20 });

    expect(result.data[0].id).toBe('shopify_signal');
    expect(result.data[0].serviceHint).toBe('Ecommerce implementation');
    expect(result.data[0].toolHints).toEqual(expect.arrayContaining(['Shopify', 'Merchant center']));
    expect(result.data[0].rankingReasons).toEqual(expect.arrayContaining([
      'Clear ecommerce implementation demand',
    ]));
  });
});
