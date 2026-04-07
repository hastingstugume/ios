import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  const configGet = jest.fn();
  const service = new IngestionService(
    {} as any,
    { normalize: jest.fn((text: string) => text), classify: jest.fn() } as any,
    { get: configGet } as any,
    {} as any,
  );

  beforeEach(() => {
    configGet.mockReset();
    configGet.mockImplementation((_key: string, defaultValue?: any) => defaultValue ?? '');
  });

  it('canonicalizes URLs by removing tracking params and hashes', () => {
    const canonical = (service as any).canonicalizeUrl('https://example.com/path/?utm_source=x&utm_medium=y&id=123#section');
    expect(canonical).toBe('https://example.com/path?id=123');
  });

  it('excludes content when a source exclude term matches', () => {
    const excluded = (service as any).shouldExcludeItem(
      'this is a roundup of tools and affiliate offers',
      { excludeTerms: ['affiliate', 'newsletter'] },
    );
    expect(excluded).toBe(true);
  });

  it('applies source weighting to confidence score', () => {
    const weighted = (service as any).applySourceWeighting(
      {
        isOpportunity: true,
        category: 'BUYING_INTENT',
        confidenceScore: 80,
        whyItMatters: '',
        suggestedOutreach: null,
        suggestedReply: null,
        painPoint: null,
        urgency: 'MEDIUM',
        sentiment: 'NEUTRAL',
        conversationType: 'BUYER_REQUEST',
      },
      'WEB_SEARCH',
      { sourceWeight: 1.2 },
    );
    expect(weighted.confidenceScore).toBe(82);
  });

  it('fails clearly when web search is disabled', async () => {
    configGet.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'WEB_SEARCH_PROVIDER') return 'disabled';
      return defaultValue ?? '';
    });

    await expect(
      (service as any).fetchWebSearch({ query: 'recommend consultant', domains: ['example.com'] }),
    ).rejects.toThrow('Web search is disabled until an approved search provider is configured');
  });

  it('fails clearly when serpapi is selected without credentials', async () => {
    configGet.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'WEB_SEARCH_PROVIDER') return 'serpapi';
      if (key === 'SERPAPI_API_KEY') return '';
      return defaultValue ?? '';
    });

    await expect(
      (service as any).fetchWebSearch({ query: 'recommend consultant', domains: ['example.com'] }),
    ).rejects.toThrow('SerpApi is selected for web search, but SERPAPI_API_KEY is not configured');
  });

  it('fails clearly when SAM.gov is selected without credentials', async () => {
    configGet.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'SAM_GOV_API_KEY') return '';
      return defaultValue ?? '';
    });

    await expect(
      (service as any).fetchSamGov({ query: 'cybersecurity support' }),
    ).rejects.toThrow('SAM.gov is selected, but SAM_GOV_API_KEY is not configured');
  });

  it('filters discourse latest topics using query and tags', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{ id: 7, username: 'alice' }],
        topic_list: {
          topics: [
            {
              id: 101,
              slug: 'need-consultant-help',
              title: 'Need consultant help with CRM migration',
              excerpt: 'We need implementation support this month',
              tags: ['consulting', 'migration'],
              posters: [{ user_id: 7, description: 'Original Poster' }],
              last_posted_at: new Date().toISOString(),
            },
            {
              id: 102,
              slug: 'weekly-community-roundup',
              title: 'Weekly community roundup',
              excerpt: 'General updates and links',
              tags: ['roundup'],
              posters: [{ user_id: 7, description: 'Original Poster' }],
              last_posted_at: new Date().toISOString(),
            },
          ],
        },
      }),
    } as any);

    const results = await (service as any).fetchDiscourse({
      baseUrl: 'https://community.example.com',
      query: '"need consultant" OR migration',
      tags: ['migration'],
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('Need consultant help');
    expect(results[0].url).toBe('https://community.example.com/t/need-consultant-help/101');

    global.fetch = originalFetch;
  });

  it('filters Dev.to articles by configured query and optional tags', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 1001,
          title: 'Need help with CRM migration',
          description: 'Our team is blocked and looking for implementation support.',
          tag_list: ['ai', 'devops'],
          url: 'https://dev.to/example/need-help-with-crm-migration',
          published_at: new Date().toISOString(),
          user: { username: 'alice' },
        },
        {
          id: 1002,
          title: 'My weekly productivity stack',
          description: 'A list of random tools.',
          tag_list: ['tools'],
          url: 'https://dev.to/example/weekly-productivity-stack',
          published_at: new Date().toISOString(),
          user: { username: 'bob' },
        },
      ]),
    } as any);

    const results = await (service as any).fetchDevToSearch({
      query: '"need help" OR migration OR consultant',
      tags: ['ai'],
      top: 30,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('Need help');
    expect(results[0].url).toContain('dev.to');

    global.fetch = originalFetch;
  });

  it('filters GitLab search results for issues and merge-request pain', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 701,
          title: 'Blocked on migration rollout',
          description: 'Need support with deployment migration',
          web_url: 'https://gitlab.com/example/project/-/issues/701',
          created_at: new Date().toISOString(),
          author: { username: 'alice' },
          labels: ['migration'],
        },
      ]),
    } as any);

    const results = await (service as any).fetchGitLabSearch({
      query: 'blocked migration OR need support',
      scope: 'issues',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('Blocked on migration');
    expect(results[0].url).toContain('gitlab.com');

    global.fetch = originalFetch;
  });

  it('fails clearly when YouTube search is selected without credentials', async () => {
    configGet.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'YOUTUBE_API_KEY') return '';
      return defaultValue ?? '';
    });

    await expect(
      (service as any).fetchYoutubeSearch({ query: 'migration issue' }),
    ).rejects.toThrow('YouTube search is selected, but YOUTUBE_API_KEY is not configured');
  });

  it('filters weak low-signal web search snippets without clear buying intent', () => {
    const excluded = (service as any).shouldExcludeAsLowSignal(
      'WEB_SEARCH',
      'Weekly roundup of no-code tools',
      'A short list of tools we like this week',
      1,
    );
    expect(excluded).toBe(true);
  });

  it('keeps broad-source content when it contains strong recommendation intent', () => {
    const excluded = (service as any).shouldExcludeAsLowSignal(
      'RSS',
      'Need help choosing a CRM implementation partner',
      'We are looking for a consultant to help migrate HubSpot and Salesforce workflows',
      1,
    );
    expect(excluded).toBe(false);
  });

  it('matches configured search intent even without an exact tracked keyword hit', () => {
    const matched = (service as any).matchesConfiguredIntent(
      'need help migrating our shopify storefront and fixing merchant center tracking',
      'WEB_SEARCH',
      { query: '"shopify expert" OR "shopify agency" OR "merchant center support"' },
    );
    expect(matched).toBe(true);
  });

  it('does not treat weak generic chatter as configured intent', () => {
    const matched = (service as any).matchesConfiguredIntent(
      'sharing our favorite storefront inspiration links this week',
      'WEB_SEARCH',
      { query: '"shopify expert" OR "shopify agency"' },
    );
    expect(matched).toBe(false);
  });

  it('does not apply the low-signal heuristic to stronger source types', () => {
    const excluded = (service as any).shouldExcludeAsLowSignal(
      'GITHUB_SEARCH',
      'Weekly roundup of automation tools',
      'A short list of tools we like this week',
      0,
    );
    expect(excluded).toBe(false);
  });

  it('excludes content when a workspace negative keyword matches', () => {
    const excluded = (service as any).shouldExcludeByWorkspace(
      'this post is about wordpress plugin maintenance',
      ['wordpress', 'crypto'],
    );
    expect(excluded).toBe(true);
  });

  it('creates stable title fingerprints for near-duplicate titles', () => {
    const left = (service as any).createTitleFingerprint('Looking for a DevOps consultant for Kubernetes migration');
    const right = (service as any).createTitleFingerprint('Looking for DevOps consultant for a Kubernetes migration');
    expect(left).toBe(right);
  });

  it('detects mirrored URLs as duplicate candidates', () => {
    const duplicate = (service as any).isLikelyDuplicateCandidate(
      {
        canonicalUrl: 'https://www.example.com/discussions/devops-help?utm_source=x',
        title: 'Need DevOps help',
        normalizedText: 'Need DevOps help with CI CD',
        titleFingerprint: (service as any).createTitleFingerprint('Need DevOps help'),
      },
      {
        canonicalUrl: 'https://example.com/discussions/devops-help',
        title: 'Need DevOps help',
        normalizedText: 'Need DevOps help with CI CD',
        titleFingerprint: (service as any).createTitleFingerprint('Need DevOps help'),
      },
    );
    expect(duplicate).toBe(true);
  });

  it('detects near-identical titles and text as duplicate candidates', () => {
    const duplicate = (service as any).isLikelyDuplicateCandidate(
      {
        canonicalUrl: 'https://community.example.com/post/one',
        title: 'Best AI automation agency for healthcare startup',
        normalizedText: 'Best AI automation agency for healthcare startup with intake workflow issues',
        titleFingerprint: (service as any).createTitleFingerprint('Best AI automation agency for healthcare startup'),
      },
      {
        canonicalUrl: 'https://another.example.com/thread/two',
        title: 'Best AI automation agency for a healthcare startup',
        normalizedText: 'Best AI automation agency for healthcare startup with intake workflow issues',
        titleFingerprint: (service as any).createTitleFingerprint('Best AI automation agency for a healthcare startup'),
      },
    );
    expect(duplicate).toBe(true);
  });

  it('does not persist a signal when classification says it is not an opportunity', async () => {
    const prisma = {
      keyword: { findMany: jest.fn().mockResolvedValue([{ id: 'kw1', phrase: 'shopify expert' }]) },
      organization: { findUnique: jest.fn().mockResolvedValue({ negativeKeywords: [] }) },
      signal: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      signalKeyword: { create: jest.fn() },
    };
    const classify = jest.fn().mockResolvedValue({
      isOpportunity: false,
      category: 'OTHER',
      confidenceScore: 32,
      whyItMatters: 'Weak mention.',
      suggestedOutreach: null,
      suggestedReply: null,
      painPoint: null,
      urgency: 'LOW',
      sentiment: 'NEUTRAL',
      conversationType: 'OTHER',
    });
    const queue = { add: jest.fn() };
    const isolated = new IngestionService(
      prisma as any,
      { normalize: jest.fn((text: string) => text), classify } as any,
      { get: jest.fn((_key: string, defaultValue?: any) => defaultValue ?? '') } as any,
      queue as any,
    );

    await (isolated as any).processItems(
      'source-1',
      'org-1',
      'WEB_SEARCH',
      { query: '"shopify expert" OR "shopify agency"' },
      [{
        externalId: 'ext-1',
        title: 'Need help migrating our Shopify store',
        text: 'Our tracking and merchant center setup is broken and we need help fast.',
        url: 'https://example.com/post',
      }],
    );

    expect(classify).toHaveBeenCalled();
    expect(prisma.signal.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalledWith('check-alerts', expect.anything());
  });
});
