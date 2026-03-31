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
});
