import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../classification/classification.service';
import { ConfigService } from '@nestjs/config';
import { SourceType } from '@prisma/client';

type IngestionItem = {
  externalId: string;
  title?: string;
  text: string;
  url: string;
  author?: string;
  publishedAt?: Date;
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private prisma: PrismaService,
    private classification: ClassificationService,
    private config: ConfigService,
    @InjectQueue('ingestion') private ingestionQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleFetch() {
    const activeSources = await this.prisma.source.findMany({
      where: { status: 'ACTIVE' },
    });
    for (const source of activeSources) {
      await this.ingestionQueue.add('fetch-source', { sourceId: source.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
    }
    this.logger.log(`Scheduled fetch for ${activeSources.length} sources`);
  }

  async fetchSource(sourceId: string) {
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) return;

    try {
      const items = await this.fetchItemsForSource(source.type, source.config as Record<string, any>);

      await this.processItems(source.id, source.organizationId, source.type, source.config as Record<string, any>, items);
      await this.prisma.source.update({
        where: { id: sourceId },
        data: { lastFetchedAt: new Date(), errorMessage: null },
      });
    } catch (err: any) {
      this.logger.error(`Failed to fetch source ${sourceId}: ${err.message}`);
      await this.prisma.source.update({
        where: { id: sourceId },
        data: { errorMessage: this.toSafeSourceError(err?.message), status: 'ERROR' },
      });
    }
  }

  private async fetchReddit(config: { subreddit: string; limit?: number }) {
    const { subreddit, limit = 25 } = config;
    const reddit = await this.getRedditAuthHeaders(`r/${subreddit}`);
    if (!reddit) return [];

    try {
      const res = await fetch(
        `https://oauth.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
        { headers: reddit.headers },
      );
      const data = await res.json() as any;

      return (data.data?.children || []).map((c: any) => ({
        externalId: c.data.id,
        title: c.data.title,
        text: c.data.selftext || c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        author: c.data.author,
        publishedAt: new Date(c.data.created_utc * 1000),
      }));
    } catch (err: any) {
      throw new Error(`Reddit fetch failed: ${err.message}`);
    }
  }

  private async fetchRedditSearch(config: { query: string; subreddit?: string; sort?: 'new' | 'relevance' | 'top'; limit?: number }) {
    const { query, subreddit, sort = 'new', limit = 25 } = config;
    const label = subreddit ? `r/${subreddit} search` : 'reddit search';
    const reddit = await this.getRedditAuthHeaders(label);
    if (!reddit) return [];

    try {
      const baseUrl = subreddit
        ? `https://oauth.reddit.com/r/${subreddit}/search.json`
        : 'https://oauth.reddit.com/search.json';
      const qs = new URLSearchParams({
        q: query,
        sort,
        limit: String(limit),
        restrict_sr: subreddit ? '1' : '0',
      }).toString();
      const res = await fetch(`${baseUrl}?${qs}`, { headers: reddit.headers });
      const data = await res.json() as any;

      return (data.data?.children || []).map((c: any) => ({
        externalId: c.data.id,
        title: c.data.title,
        text: c.data.selftext || c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        author: c.data.author,
        publishedAt: new Date(c.data.created_utc * 1000),
      }));
    } catch (err: any) {
      throw new Error(`Reddit search failed: ${err.message}`);
    }
  }

  private async fetchRSS(config: { url: string }) {
    const Parser = require('rss-parser');
    const parser = new Parser();
    try {
      const feed = await parser.parseURL(config.url);
      return (feed.items || []).slice(0, 50).map((item: any) => ({
        externalId: item.guid || item.link || item.title,
        title: item.title,
        text: item.contentSnippet || item.content || item.title || '',
        url: item.link || '',
        author: item.creator || item.author,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      }));
    } catch (err: any) {
      throw new Error(`RSS fetch failed: ${err.message}`);
    }
  }

  private async fetchHnSearch(config: { query: string; tags?: string; limit?: number }) {
    const { query, tags = 'story', limit = 25 } = config;
    try {
      const qs = new URLSearchParams({
        query,
        tags,
        hitsPerPage: String(limit),
      }).toString();
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${qs}`);
      const data = await res.json() as any;

      return (data.hits || [])
        .filter((item: any) => item.objectID && (item.url || item.story_url))
        .map((item: any) => ({
          externalId: `hn-${item.objectID}`,
          title: item.title || item.story_title || query,
          text: item.comment_text || item.story_text || item.title || item.story_title || '',
          url: item.url || item.story_url,
          author: item.author,
          publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
        }));
    } catch (err: any) {
      throw new Error(`HN search failed: ${err.message}`);
    }
  }

  private async fetchWebSearch(config: { query: string; domains?: string[]; limit?: number }) {
    const { query, domains = [], limit = 20 } = config;
    const domainQuery = domains.length
      ? `${query} ${domains.map((domain) => `site:${domain}`).join(' OR ')}`
      : query;

    try {
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(domainQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; InternetOpportunityScanner/0.1; +https://opportunity-scanner.local)',
        },
      });
      const html = await response.text();
      const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/g)];

      return matches.slice(0, limit).map((match, index) => {
        const url = this.extractDuckDuckGoUrl(match[1]);
        const title = this.stripHtml(match[2]);
        const snippet = this.stripHtml(match[3]);
        return {
          externalId: `web-${Buffer.from(url).toString('base64').slice(0, 32)}-${index}`,
          title,
          text: snippet || title,
          url,
          publishedAt: new Date(),
        };
      }).filter((item) => item.url);
    } catch (err: any) {
      throw new Error(`Web search failed: ${err.message}`);
    }
  }

  private async fetchGitHubSearch(config: { query: string; repo?: string; type?: 'issues' | 'discussions'; limit?: number }) {
    const { query, repo, type = 'discussions', limit = 20 } = config;
    const scopedQuery = repo ? `${query} repo:${repo}` : query;

    try {
      const searchUrl = `https://github.com/search?q=${encodeURIComponent(scopedQuery)}&type=${type}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; InternetOpportunityScanner/0.1; +https://opportunity-scanner.local)',
        },
      });
      const html = await response.text();

      const linkMatches = [...html.matchAll(/<a[^>]*href="(\/[^"]+)"[^>]*class="[^"]*search-title[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
      const snippetMatches = [...html.matchAll(/<div[^>]*class="[^"]*search-title[^"]*"[\s\S]*?<div[^>]*class="[^"]*search-match[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];

      return linkMatches.slice(0, limit).map((match, index) => {
        const path = match[1];
        const title = this.stripHtml(match[2]);
        const snippet = this.stripHtml(snippetMatches[index]?.[1] || '');
        return {
          externalId: `gh-${path.replace(/[^\w/-]+/g, '').replace(/\//g, '-')}`,
          title,
          text: snippet || title,
          url: `https://github.com${path}`,
          publishedAt: new Date(),
        };
      }).filter((item) => item.url && item.title);
    } catch (err: any) {
      throw new Error(`GitHub search failed: ${err.message}`);
    }
  }

  private async fetchStackOverflowSearch(config: { query: string; tags?: string[]; sort?: 'activity' | 'votes' | 'creation'; limit?: number }) {
    const { query, tags = [], sort = 'activity', limit = 20 } = config;

    try {
      const qs = new URLSearchParams({
        order: 'desc',
        sort,
        q: query,
        site: 'stackoverflow',
        pagesize: String(limit),
        filter: 'default',
      });
      if (tags.length) qs.set('tagged', tags.join(';'));

      const response = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${qs.toString()}`);
      const data = await response.json() as any;

      return (data.items || []).map((item: any) => ({
        externalId: `so-${item.question_id}`,
        title: this.stripHtml(item.title || query),
        text: this.stripHtml(item.title || '') + (item.tags?.length ? ` Tags: ${item.tags.join(', ')}` : ''),
        url: item.link,
        author: item.owner?.display_name,
        publishedAt: item.creation_date ? new Date(item.creation_date * 1000) : new Date(),
      })).filter((item: any) => item.url);
    } catch (err: any) {
      throw new Error(`Stack Overflow search failed: ${err.message}`);
    }
  }

  private async processItems(
    sourceId: string,
    orgId: string,
    sourceType: SourceType,
    sourceConfig: Record<string, any>,
    items: IngestionItem[],
  ) {
    const [keywords, workspaceNegativeKeywords] = await Promise.all([
      this.prisma.keyword.findMany({
        where: { organizationId: orgId, isActive: true },
      }),
      this.getWorkspaceNegativeKeywords(orgId),
    ]);
    const kwPhrases = keywords.map((k) => k.phrase);

    for (const item of items) {
      const content = `${item.title || ''} ${item.text}`.toLowerCase();
      if (this.shouldExcludeByWorkspace(content, workspaceNegativeKeywords)) continue;
      if (this.shouldExcludeItem(content, sourceConfig)) continue;
      const matchedKeywords = keywords.filter((k) => content.includes(k.phrase.toLowerCase()));
      if (matchedKeywords.length === 0) continue;

      const canonicalUrl = this.canonicalizeUrl(item.url);
      const normalizedText = this.classification.normalize(item.text);
      const existing = await this.prisma.signal.findUnique({
        where: { organizationId_sourceId_externalId: { organizationId: orgId, sourceId, externalId: item.externalId } },
      });
      if (existing) {
        await this.attachMatchedKeywords(existing.id, matchedKeywords);
        continue;
      }

      const duplicate = await this.findDuplicateSignal(orgId, canonicalUrl, item.title || null, normalizedText);
      if (duplicate) {
        await this.attachMatchedKeywords(duplicate.id, matchedKeywords);
        continue;
      }

      const classification = this.applySourceWeighting(
        await this.classification.classify(item.title || null, item.text, kwPhrases),
        sourceType,
        sourceConfig,
      );

      const signal = await this.prisma.signal.create({
        data: {
          organizationId: orgId,
          sourceId,
          externalId: item.externalId,
          sourceUrl: canonicalUrl,
          authorHandle: item.author,
          originalTitle: item.title,
          originalText: item.text.slice(0, 10000),
          normalizedText,
          publishedAt: item.publishedAt,
          category: classification.category,
          confidenceScore: classification.confidenceScore,
          whyItMatters: classification.whyItMatters,
          suggestedOutreach: classification.suggestedOutreach,
          classifiedAt: new Date(),
          classificationRaw: {
            ...classification,
            canonicalUrl,
            discoverySourceType: sourceType,
          } as any,
        },
      });

      await this.attachMatchedKeywords(signal.id, matchedKeywords);

      // Queue alerts check
      await this.ingestionQueue.add('check-alerts', {
        orgId,
        signalId: signal.id,
        confidenceScore: classification.confidenceScore,
        category: classification.category,
      });
    }
  }

  private async attachMatchedKeywords(signalId: string, matchedKeywords: Array<{ id: string }>) {
    for (const kw of matchedKeywords) {
      await this.prisma.signalKeyword.create({
        data: { signalId, keywordId: kw.id },
      }).catch(() => {});
    }
  }

  private async findDuplicateSignal(orgId: string, canonicalUrl: string, title: string | null, normalizedText: string) {
    if (canonicalUrl) {
      const exactUrlMatch = await this.prisma.signal.findFirst({
        where: {
          organizationId: orgId,
          sourceUrl: canonicalUrl,
        },
        select: { id: true },
      });
      if (exactUrlMatch) return exactUrlMatch;
    }

    if (title && normalizedText) {
      const exactContentMatch = await this.prisma.signal.findFirst({
        where: {
          organizationId: orgId,
          originalTitle: { equals: title, mode: 'insensitive' },
          normalizedText,
        },
        select: { id: true },
      });
      if (exactContentMatch) return exactContentMatch;
    }

    const titleFingerprint = this.createTitleFingerprint(title);
    if (!canonicalUrl && !titleFingerprint) return null;

    const recentCandidates = await this.prisma.signal.findMany({
      where: {
        organizationId: orgId,
        fetchedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { fetchedAt: 'desc' },
      take: 80,
      select: {
        id: true,
        sourceUrl: true,
        originalTitle: true,
        normalizedText: true,
      },
    });

    for (const candidate of recentCandidates) {
      if (this.isLikelyDuplicateCandidate(
        {
          canonicalUrl,
          title,
          normalizedText,
          titleFingerprint,
        },
        {
          canonicalUrl: candidate.sourceUrl,
          title: candidate.originalTitle,
          normalizedText: candidate.normalizedText,
          titleFingerprint: this.createTitleFingerprint(candidate.originalTitle),
        },
      )) {
        return { id: candidate.id };
      }
    }

    return null;
  }

  async triggerManualFetch(orgId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({ where: { id: sourceId, organizationId: orgId } });
    if (!source) throw new Error('Source not found');
    await this.ingestionQueue.add('fetch-source', { sourceId });
    return { queued: true };
  }

  async previewSource(
    orgId: string,
    sourceType: SourceType,
    sourceConfig: Record<string, any>,
  ) {
    const [items, keywords, workspaceNegativeKeywords] = await Promise.all([
      this.fetchItemsForSource(sourceType, sourceConfig),
      this.prisma.keyword.findMany({
        where: { organizationId: orgId, isActive: true },
      }),
      this.getWorkspaceNegativeKeywords(orgId),
    ]);

    const kwPhrases = keywords.map((keyword) => keyword.phrase);
    const previewItems = await Promise.all(items.slice(0, 8).map(async (item) => {
      const content = `${item.title || ''} ${item.text}`.toLowerCase();
      const matchedKeywords = keywords
        .filter((keyword) => content.includes(keyword.phrase.toLowerCase()))
        .map((keyword) => keyword.phrase);
      const excludedByWorkspace = this.shouldExcludeByWorkspace(content, workspaceNegativeKeywords);
      const excludedBySource = this.shouldExcludeItem(content, sourceConfig);
      const passesFilters = matchedKeywords.length > 0 && !excludedByWorkspace && !excludedBySource;
      const classification = passesFilters
        ? this.applySourceWeighting(
            await this.classification.classify(item.title || null, item.text, kwPhrases),
            sourceType,
            sourceConfig,
          )
        : null;

      return {
        externalId: item.externalId,
        title: item.title || 'Untitled result',
        text: item.text.slice(0, 280),
        url: this.canonicalizeUrl(item.url),
        author: item.author || null,
        publishedAt: item.publishedAt || null,
        matchedKeywords,
        excludedByWorkspace,
        excludedBySource,
        passesFilters,
        category: classification?.category || null,
        confidenceScore: classification?.confidenceScore || null,
        whyItMatters: classification?.whyItMatters || null,
      };
    }));

    return {
      totalFetched: items.length,
      matchingCount: previewItems.filter((item) => item.passesFilters).length,
      previewItems,
    };
  }

  private async fetchItemsForSource(sourceType: SourceType, sourceConfig: Record<string, any>): Promise<IngestionItem[]> {
    if (sourceType === SourceType.REDDIT) {
      return this.fetchReddit(sourceConfig as any);
    }
    if (sourceType === SourceType.REDDIT_SEARCH) {
      return this.fetchRedditSearch(sourceConfig as any);
    }
    if (sourceType === SourceType.RSS) {
      return this.fetchRSS(sourceConfig as any);
    }
    if (sourceType === SourceType.HN_SEARCH) {
      return this.fetchHnSearch(sourceConfig as any);
    }
    if (sourceType === SourceType.GITHUB_SEARCH) {
      return this.fetchGitHubSearch(sourceConfig as any);
    }
    if (sourceType === SourceType.STACKOVERFLOW_SEARCH) {
      return this.fetchStackOverflowSearch(sourceConfig as any);
    }
    if (sourceType === SourceType.WEB_SEARCH) {
      return this.fetchWebSearch(sourceConfig as any);
    }

    return [];
  }

  private async getWorkspaceNegativeKeywords(orgId: string) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { negativeKeywords: true },
      });
      return organization?.negativeKeywords || [];
    } catch (error: any) {
      this.logger.warn(`Failed to load workspace negative keywords for ${orgId}: ${error?.message || 'unknown error'}`);
      return [];
    }
  }

  private toSafeSourceError(message?: string) {
    if (!message) return 'Fetch failed';

    if (message.includes('organization.findUnique()')) {
      return 'Workspace settings could not be loaded';
    }

    if (message.includes('negativeKeywords')) {
      return 'Workspace filters could not be loaded';
    }

    return message;
  }

  private async getRedditAuthHeaders(label: string) {
    const clientId = this.config.get('REDDIT_CLIENT_ID', '');
    const clientSecret = this.config.get('REDDIT_CLIENT_SECRET', '');
    const userAgent = this.config.get('REDDIT_USER_AGENT', 'InternetOpportunityScanner/0.1');

    if (!clientId || clientId === 'replace-with-client-id') {
      this.logger.warn(`Reddit credentials not configured, skipping ${label}`);
      return null;
    }

    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json() as any;

    return {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': userAgent,
      },
    };
  }

  private stripHtml(value: string) {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractDuckDuckGoUrl(rawUrl: string) {
    try {
      const decoded = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
      const parsed = new URL(decoded, 'https://duckduckgo.com');
      const target = parsed.searchParams.get('uddg');
      return target ? decodeURIComponent(target) : decoded;
    } catch {
      return rawUrl;
    }
  }

  private canonicalizeUrl(rawUrl: string) {
    if (!rawUrl) return rawUrl;

    try {
      const parsed = new URL(rawUrl);
      parsed.hash = '';

      for (const key of [...parsed.searchParams.keys()]) {
        if (/^(utm_|ref$|ref_src$|source$|feature$|fbclid$|gclid$)/i.test(key)) {
          parsed.searchParams.delete(key);
        }
      }

      const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
      parsed.pathname = pathname;

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  private normalizeUrlForDuplicateComparison(rawUrl: string) {
    if (!rawUrl) return '';

    try {
      const parsed = new URL(this.canonicalizeUrl(rawUrl));
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      const pathname = parsed.pathname
        .replace(/\/+$/, '')
        .toLowerCase()
        .replace(/\/(comments|comment|discussion|discussions)\/[^/]+\/?$/i, '');
      return `${host}${pathname || '/'}`;
    } catch {
      return rawUrl.toLowerCase().trim();
    }
  }

  private createTitleFingerprint(title: string | null | undefined) {
    if (!title) return '';

    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'my', 'our', 'your', 'need', 'looking']);
    const tokens = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token));

    return [...new Set(tokens)].sort().slice(0, 8).join(' ');
  }

  private calculateTokenOverlap(left: string, right: string) {
    if (!left || !right) return 0;

    const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
    const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
    if (!leftTokens.size || !rightTokens.size) return 0;

    let intersection = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) intersection += 1;
    }

    return intersection / Math.max(leftTokens.size, rightTokens.size);
  }

  private isLikelyDuplicateCandidate(
    incoming: { canonicalUrl: string; title: string | null; normalizedText: string; titleFingerprint: string },
    existing: { canonicalUrl: string; title: string | null; normalizedText: string | null; titleFingerprint: string },
  ) {
    const incomingUrlKey = this.normalizeUrlForDuplicateComparison(incoming.canonicalUrl);
    const existingUrlKey = this.normalizeUrlForDuplicateComparison(existing.canonicalUrl);
    if (incomingUrlKey && existingUrlKey && incomingUrlKey === existingUrlKey) {
      return true;
    }

    if (incoming.titleFingerprint && existing.titleFingerprint && incoming.titleFingerprint === existing.titleFingerprint) {
      return true;
    }

    const titleSimilarity = this.calculateTokenOverlap(
      this.createTitleFingerprint(incoming.title),
      this.createTitleFingerprint(existing.title),
    );
    const textSimilarity = this.calculateTokenOverlap(
      incoming.normalizedText.slice(0, 180),
      (existing.normalizedText || '').slice(0, 180),
    );

    return titleSimilarity >= 0.8 || (titleSimilarity >= 0.6 && textSimilarity >= 0.6);
  }

  private shouldExcludeItem(content: string, sourceConfig: Record<string, any>) {
    const excludeTerms = Array.isArray(sourceConfig.excludeTerms)
      ? sourceConfig.excludeTerms.map((term: unknown) => String(term).toLowerCase().trim()).filter(Boolean)
      : [];

    return excludeTerms.some((term) => content.includes(term));
  }

  private shouldExcludeByWorkspace(content: string, negativeKeywords: string[]) {
    return negativeKeywords
      .map((term) => term.toLowerCase().trim())
      .filter(Boolean)
      .some((term) => content.includes(term));
  }

  private applySourceWeighting(
    classification: {
      isOpportunity: boolean;
      category: any;
      confidenceScore: number;
      whyItMatters: string;
      suggestedOutreach: string | null;
    },
    sourceType: SourceType,
    sourceConfig: Record<string, any>,
  ) {
    const sourceTypeWeights: Record<string, number> = {
      REDDIT: 1.05,
      REDDIT_SEARCH: 1.0,
      RSS: 0.95,
      HN_SEARCH: 1.05,
      GITHUB_SEARCH: 0.95,
      STACKOVERFLOW_SEARCH: 0.9,
      WEB_SEARCH: 0.85,
      MANUAL: 1.0,
      TWITTER: 0.9,
    };

    const configuredWeightRaw = Number(sourceConfig.sourceWeight ?? 1);
    const configuredWeight = Number.isFinite(configuredWeightRaw)
      ? Math.min(1.5, Math.max(0.5, configuredWeightRaw))
      : 1;
    const weightedScore = Math.round(
      classification.confidenceScore * (sourceTypeWeights[sourceType] ?? 1) * configuredWeight,
    );

    return {
      ...classification,
      confidenceScore: Math.min(100, Math.max(0, weightedScore)),
    };
  }
}
