import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  const service = new IngestionService(
    {} as any,
    { normalize: jest.fn((text: string) => text), classify: jest.fn() } as any,
    { get: jest.fn() } as any,
    {} as any,
  );

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
