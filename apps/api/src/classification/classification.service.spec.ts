import { Test, TestingModule } from '@nestjs/testing';
import { ClassificationService } from '../classification/classification.service';
import { ConfigService } from '@nestjs/config';
import { SignalCategory } from '@prisma/client';

describe('ClassificationService (fallback)', () => {
  let service: ClassificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: ConfigService, useValue: { get: (key: string, def?: any) => def } },
      ],
    }).compile();
    service = module.get(ClassificationService);
  });

  it('should classify a buying intent post', async () => {
    const result = await service.classify(
      'Looking for a Kubernetes consultant to help us migrate',
      'We need to hire a DevOps consultant with Kubernetes experience. Budget is $30k.',
      ['Kubernetes consultant', 'DevOps consultant'],
    );
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.whyItMatters).toBeTruthy();
  });

  it('should normalize text', () => {
    const messy = 'Check out https://example.com   for more    info!';
    const result = service.normalize(messy);
    expect(result).not.toContain('https://');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('should truncate very long text', () => {
    const long = 'a'.repeat(5000);
    expect(service.normalize(long).length).toBeLessThanOrEqual(1000);
  });

  it('builds non-reddit fallback source suggestions for freelancer workspaces', async () => {
    const suggestions = await service.generateSourceSuggestions({
      organizationName: 'Solo Ops',
      accountType: 'FREELANCER',
      businessFocus: 'automation',
      targetAudience: 'founders',
      trackedKeywords: ['automation consultant'],
      negativeKeywords: ['course'],
    });

    expect(suggestions).toHaveLength(3);
    const sourceTypes = suggestions.flatMap((pack) => pack.sources.map((source) => source.type));
    expect(sourceTypes).not.toContain('REDDIT_SEARCH');
    const webDomains = suggestions
      .flatMap((pack) => pack.sources)
      .filter((source) => source.type === 'WEB_SEARCH')
      .flatMap((source) => (source.config.domains || []) as string[]);
    expect(webDomains).not.toContain('reddit.com');
  });

  it('builds non-reddit fallback source suggestions for business workspaces', async () => {
    const suggestions = await service.generateSourceSuggestions({
      organizationName: 'Pipeline Partners',
      accountType: 'BUSINESS',
      businessFocus: 'crm implementation',
      targetAudience: 'operators',
      trackedKeywords: ['crm migration'],
      negativeKeywords: ['job'],
    });

    expect(suggestions).toHaveLength(3);
    const sourceTypes = suggestions.flatMap((pack) => pack.sources.map((source) => source.type));
    expect(sourceTypes).not.toContain('REDDIT_SEARCH');
    const webDomains = suggestions
      .flatMap((pack) => pack.sources)
      .filter((source) => source.type === 'WEB_SEARCH')
      .flatMap((source) => (source.config.domains || []) as string[]);
    expect(webDomains).not.toContain('reddit.com');
  });
});
