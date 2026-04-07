import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../classification/classification.service';
import { ConfigService } from '@nestjs/config';
import { SourceType } from '@prisma/client';
import { getSourceProfile } from '../sources/source-profiles';

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
    const provider = (this.config.get('WEB_SEARCH_PROVIDER', 'legacy') || 'legacy').toLowerCase();

    if (provider === 'disabled') {
      throw new Error('Web search is disabled until an approved search provider is configured');
    }

    if (provider === 'serpapi') {
      return this.fetchSerpApiSearch(config);
    }

    if (provider !== 'legacy') {
      throw new Error(`Unsupported web search provider "${provider}"`);
    }

    return this.fetchLegacyWebSearch(config);
  }

  private async fetchLegacyWebSearch(config: { query: string; domains?: string[]; limit?: number }) {
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

  private async fetchDiscourse(config: {
    baseUrl: string;
    query?: string;
    tags?: string[];
    postedWithinDays?: number;
    limit?: number;
  }) {
    const { baseUrl, query = '', tags = [], postedWithinDays = 30, limit = 25 } = config;
    const communityBaseUrl = baseUrl.replace(/\/+$/, '');
    const cutoffTime = Date.now() - postedWithinDays * 24 * 60 * 60 * 1000;

    try {
      const response = await fetch(`${communityBaseUrl}/latest.json`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InternetOpportunityScanner/0.1',
        },
      });
      if (!response.ok) {
        throw new Error(`Discourse returned ${response.status}`);
      }

      const data = await response.json() as any;
      const users = new Map<number, any>((data.users || []).map((user: any) => [user.id, user]));
      const topics = data.topic_list?.topics || [];

      return topics
        .filter((topic: any) => {
          const publishedAt = topic.last_posted_at || topic.created_at;
          return !publishedAt || new Date(publishedAt).getTime() >= cutoffTime;
        })
        .filter((topic: any) => {
          const topicTags = Array.isArray(topic.tags) ? topic.tags.map((tag: string) => tag.toLowerCase()) : [];
          return !tags.length || tags.some((tag) => topicTags.includes(tag.toLowerCase()));
        })
        .filter((topic: any) => {
          if (!query.trim()) return true;
          const haystack = this.stripHtml(
            [topic.title, topic.fancy_title, topic.excerpt, ...(topic.tags || [])].filter(Boolean).join(' '),
          ).toLowerCase();
          return this.matchesLooseSearchQuery(haystack, query);
        })
        .slice(0, limit)
        .map((topic: any, index: number) => {
          const primaryPoster = Array.isArray(topic.posters)
            ? topic.posters.find((poster: any) => poster.description === 'Original Poster') || topic.posters[0]
            : null;
          const author = primaryPoster?.user_id ? users.get(primaryPoster.user_id)?.username : null;

          return {
            externalId: `discourse-${topic.id || index}`,
            title: this.stripHtml(topic.title || query || 'Community discussion'),
            text: this.stripHtml(
              [topic.excerpt, topic.tags?.length ? `Tags: ${topic.tags.join(', ')}` : ''].filter(Boolean).join(' · '),
            ).slice(0, 1500),
            url: topic.slug && topic.id ? `${communityBaseUrl}/t/${topic.slug}/${topic.id}` : `${communityBaseUrl}/latest`,
            author,
            publishedAt: topic.last_posted_at ? new Date(topic.last_posted_at) : topic.created_at ? new Date(topic.created_at) : new Date(),
          };
        })
        .filter((item: IngestionItem) => item.title && item.url);
    } catch (err: any) {
      throw new Error(`Discourse fetch failed: ${err.message}`);
    }
  }

  private async fetchDevToSearch(config: {
    query: string;
    tags?: string[];
    top?: number;
    limit?: number;
  }) {
    const { query, tags = [], top = 30, limit = 25 } = config;
    const cleanTags = tags
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 4);
    const apiKey = this.config.get('DEVTO_API_KEY', '');

    const buildUrl = (tag?: string) => {
      const qs = new URLSearchParams({
        per_page: String(Math.min(60, Math.max(limit * 2, 20))),
        top: String(Math.min(365, Math.max(1, Number(top) || 30))),
      });
      if (tag) qs.set('tag', tag);
      return `https://dev.to/api/articles?${qs.toString()}`;
    };

    try {
      const requests = cleanTags.length
        ? cleanTags.map((tag) => fetch(buildUrl(tag), {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'InternetOpportunityScanner/0.1',
              ...(apiKey ? { 'api-key': apiKey } : {}),
            },
          }))
        : [fetch(buildUrl(), {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'InternetOpportunityScanner/0.1',
              ...(apiKey ? { 'api-key': apiKey } : {}),
            },
          })];

      const responses = await Promise.all(requests);
      for (const response of responses) {
        if (!response.ok) {
          throw new Error(`Dev.to API returned ${response.status}`);
        }
      }

      const payloads = await Promise.all(responses.map((response) => response.json() as Promise<any[]>));
      const articles = payloads.flat();
      const deduped = new Map<string, IngestionItem>();
      for (const article of articles) {
        const id = article?.id ? `devto-${article.id}` : null;
        if (!id) continue;

        const combined = this.stripHtml(
          [
            article.title,
            article.description,
            article.tag_list ? `Tags: ${Array.isArray(article.tag_list) ? article.tag_list.join(', ') : article.tag_list}` : '',
          ].filter(Boolean).join(' · '),
        );

        if (query && !this.matchesLooseSearchQuery(combined.toLowerCase(), query.toLowerCase())) {
          continue;
        }

        deduped.set(id, {
          externalId: id,
          title: this.stripHtml(article.title || query),
          text: combined.slice(0, 1500),
          url: article.url || article.canonical_url || '',
          author: article.user?.username || article.user?.name || null,
          publishedAt: article.published_at ? new Date(article.published_at) : new Date(),
        });
      }

      return [...deduped.values()]
        .filter((item) => item.url)
        .sort((left, right) => right.publishedAt!.getTime() - left.publishedAt!.getTime())
        .slice(0, limit);
    } catch (err: any) {
      throw new Error(`Dev.to search failed: ${err.message}`);
    }
  }

  private async fetchSerpApiSearch(config: { query: string; domains?: string[]; limit?: number }) {
    const { query, domains = [], limit = 20 } = config;
    const apiKey = this.config.get('SERPAPI_API_KEY', '');
    if (!apiKey) {
      throw new Error('SerpApi is selected for web search, but SERPAPI_API_KEY is not configured');
    }

    const scopedQuery = domains.length
      ? `${query} ${domains.map((domain) => `site:${domain}`).join(' OR ')}`
      : query;

    try {
      const qs = new URLSearchParams({
        q: scopedQuery,
        api_key: apiKey,
        engine: 'google',
        num: String(Math.min(limit, 20)),
      }).toString();

      const response = await fetch(`https://serpapi.com/search.json?${qs}`, {
        headers: {
          'User-Agent': 'InternetOpportunityScanner/0.1',
        },
      });
      if (!response.ok) {
        throw new Error(`SerpApi returned ${response.status}`);
      }

      const data = await response.json() as any;
      return (data.organic_results || []).slice(0, limit).map((item: any, index: number) => ({
        externalId: `serpapi-${Buffer.from(item.link || item.title || String(index)).toString('base64').slice(0, 32)}-${index}`,
        title: item.title || query,
        text: item.snippet || item.title || '',
        url: item.link || '',
        publishedAt: new Date(),
      })).filter((item: { url: string }) => item.url);
    } catch (err: any) {
      throw new Error(`Web search failed: ${err.message}`);
    }
  }

  private async fetchGitHubSearch(config: { query: string; repo?: string; type?: 'issues' | 'discussions'; limit?: number }) {
    const { query, repo, type = 'discussions', limit = 20 } = config;
    const scopedQuery = `${repo ? `${query} repo:${repo}` : query} ${type === 'issues' ? 'is:issue' : 'is:discussion'}`.trim();
    const githubToken = this.config.get('GITHUB_TOKEN', '');

    try {
      const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(scopedQuery)}&per_page=${limit}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'InternetOpportunityScanner/0.1',
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      const data = await response.json() as any;

      return (data.items || []).slice(0, limit).map((item: any) => {
        return {
          externalId: `gh-${item.node_id || item.id}`,
          title: this.stripHtml(item.title || scopedQuery),
          text: this.stripHtml(item.body || item.title || scopedQuery).slice(0, 1500),
          url: item.html_url,
          author: item.user?.login || null,
          publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
        };
      }).filter((item: { url: string; title: string }) => item.url && item.title);
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

  private async fetchGitLabSearch(config: {
    query: string;
    scope?: 'issues' | 'merge_requests';
    project?: string;
    limit?: number;
  }) {
    const { query, scope = 'issues', project, limit = 20 } = config;
    const gitlabToken = this.config.get('GITLAB_TOKEN', '');
    const searchScope = scope === 'merge_requests' ? 'merge_requests' : 'issues';
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'InternetOpportunityScanner/0.1',
      ...(gitlabToken ? { 'PRIVATE-TOKEN': gitlabToken } : {}),
    };

    try {
      const endpoint = project
        ? `https://gitlab.com/api/v4/projects/${encodeURIComponent(project)}/search?scope=${searchScope}&search=${encodeURIComponent(query)}&per_page=${Math.min(limit, 50)}`
        : `https://gitlab.com/api/v4/search?scope=${searchScope}&search=${encodeURIComponent(query)}&per_page=${Math.min(limit, 50)}`;
      const response = await fetch(endpoint, { headers });
      if (!response.ok) {
        throw new Error(`GitLab API returned ${response.status}`);
      }

      const data = await response.json() as any[];
      return (data || []).slice(0, limit).map((item: any, index: number) => ({
        externalId: `gitlab-${searchScope}-${item.id || item.iid || index}`,
        title: this.stripHtml(item.title || item.name || query),
        text: this.stripHtml(
          [
            item.description,
            item.state ? `State: ${item.state}` : '',
            item.labels?.length ? `Labels: ${item.labels.join(', ')}` : '',
          ].filter(Boolean).join(' · '),
        ).slice(0, 1500),
        url: item.web_url || item.url || '',
        author: item.author?.username || item.author?.name || null,
        publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
      })).filter((item: IngestionItem) => item.url);
    } catch (err: any) {
      throw new Error(`GitLab search failed: ${err.message}`);
    }
  }

  private async fetchYoutubeSearch(config: {
    query: string;
    postedWithinDays?: number;
    order?: 'relevance' | 'date' | 'viewCount';
    limit?: number;
  }) {
    const { query, postedWithinDays = 30, order = 'date', limit = 20 } = config;
    const apiKey = this.config.get('YOUTUBE_API_KEY', '');
    if (!apiKey) {
      throw new Error('YouTube search is selected, but YOUTUBE_API_KEY is not configured');
    }

    const publishedAfter = new Date(Date.now() - postedWithinDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      const qs = new URLSearchParams({
        key: apiKey,
        part: 'snippet',
        type: 'video',
        q: query,
        order,
        maxResults: String(Math.min(limit, 50)),
        publishedAfter,
      }).toString();

      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InternetOpportunityScanner/0.1',
        },
      });
      if (!response.ok) {
        throw new Error(`YouTube API returned ${response.status}`);
      }

      const data = await response.json() as any;
      return (data.items || []).slice(0, limit).map((item: any, index: number) => {
        const videoId = item.id?.videoId || item.id?.playlistId || item.id?.channelId || String(index);
        return {
          externalId: `yt-${videoId}`,
          title: this.stripHtml(item.snippet?.title || query),
          text: this.stripHtml(item.snippet?.description || item.snippet?.title || '').slice(0, 1500),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          author: item.snippet?.channelTitle || null,
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date(),
        };
      }).filter((item: IngestionItem) => item.url);
    } catch (err: any) {
      throw new Error(`YouTube search failed: ${err.message}`);
    }
  }

  private async fetchSamGov(config: {
    query: string;
    naicsCode?: string;
    agency?: string;
    noticeTypes?: string[];
    postedWithinDays?: number;
    limit?: number;
  }) {
    const { query, naicsCode, agency, noticeTypes = [], postedWithinDays = 30, limit = 20 } = config;
    const apiKey = this.config.get('SAM_GOV_API_KEY', '');
    if (!apiKey) {
      throw new Error('SAM.gov is selected, but SAM_GOV_API_KEY is not configured');
    }

    const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
    const postedTo = new Date();
    const postedFrom = new Date(Date.now() - postedWithinDays * 24 * 60 * 60 * 1000);

    try {
      const qs = new URLSearchParams({
        api_key: apiKey,
        keyword: query,
        postedFrom: toIsoDate(postedFrom),
        postedTo: toIsoDate(postedTo),
        limit: String(Math.min(limit, 50)),
      });

      if (naicsCode) qs.set('ncode', naicsCode);
      if (agency) qs.set('organizationName', agency);
      if (noticeTypes.length) qs.set('ptype', noticeTypes.join(','));

      const response = await fetch(`https://api.sam.gov/prod/opportunities/v2/search?${qs.toString()}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InternetOpportunityScanner/0.1',
        },
      });
      if (!response.ok) {
        throw new Error(`SAM.gov API returned ${response.status}`);
      }

      const data = await response.json() as any;
      const opportunities = data?.opportunitiesData || data?.opportunities || [];

      return opportunities.slice(0, limit).map((item: any, index: number) => ({
        externalId: `sam-${item.noticeId || item.solicitationNumber || item.id || index}`,
        title: this.stripHtml(item.title || item.opportunityTitle || query),
        text: this.stripHtml(
          [
            item.description,
            item.fullParentPathName,
            item.organizationName,
            item.departmentName,
            item.naicsDescription,
            item.placeOfPerformance,
          ].filter(Boolean).join(' · '),
        ).slice(0, 1500),
        url: item.uiLink || item.link || 'https://sam.gov/search/?index=opp',
        author: item.organizationName || item.departmentName || null,
        publishedAt: item.postedDate ? new Date(item.postedDate) : new Date(),
      })).filter((item: IngestionItem) => item.title && item.url);
    } catch (err: any) {
      throw new Error(`SAM.gov fetch failed: ${err.message}`);
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
      const matchedKeywords = keywords.filter((k) => content.includes(k.phrase.toLowerCase()));
      const matchedConfiguredIntent = this.matchesConfiguredIntent(content, sourceType, sourceConfig);
      if (this.shouldExcludeByWorkspace(content, workspaceNegativeKeywords)) continue;
      if (this.shouldExcludeItem(content, sourceConfig)) continue;
      if (this.shouldExcludeAsLowSignal(sourceType, item.title || '', item.text, matchedKeywords.length)) continue;
      if (matchedKeywords.length === 0 && !matchedConfiguredIntent) continue;

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
      if (!classification.isOpportunity) continue;

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
      const matchedConfiguredIntent = this.matchesConfiguredIntent(content, sourceType, sourceConfig);
      const excludedByWorkspace = this.shouldExcludeByWorkspace(content, workspaceNegativeKeywords);
      const excludedBySource = this.shouldExcludeItem(content, sourceConfig);
      const excludedByLowSignal = this.shouldExcludeAsLowSignal(
        sourceType,
        item.title || '',
        item.text,
        matchedKeywords.length,
      );
      const passesDiscovery = (matchedKeywords.length > 0 || matchedConfiguredIntent) && !excludedByWorkspace && !excludedBySource && !excludedByLowSignal;
      const classification = passesDiscovery
        ? this.applySourceWeighting(
            await this.classification.classify(item.title || null, item.text, kwPhrases),
            sourceType,
            sourceConfig,
          )
        : null;
      const excludedByQualification = passesDiscovery && classification ? !classification.isOpportunity : false;
      const passesFilters = passesDiscovery && !excludedByQualification;

      return {
        externalId: item.externalId,
        title: item.title || 'Untitled result',
        text: item.text.slice(0, 280),
        url: this.canonicalizeUrl(item.url),
        author: item.author || null,
        publishedAt: item.publishedAt || null,
        matchedKeywords,
        matchedConfiguredIntent,
        excludedByWorkspace,
        excludedBySource,
        excludedByLowSignal,
        excludedByQualification,
        passesFilters,
        category: classification?.category || null,
        confidenceScore: classification?.confidenceScore || null,
        painPoint: classification?.painPoint || null,
        urgency: classification?.urgency || null,
        sentiment: classification?.sentiment || null,
        conversationType: classification?.conversationType || null,
        whyItMatters: classification?.whyItMatters || null,
        suggestedReply: classification?.suggestedReply || null,
        suggestedOutreach: classification?.suggestedOutreach || null,
        sourceProfile: getSourceProfile(sourceType),
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
    if (sourceType === SourceType.DISCOURSE) {
      return this.fetchDiscourse(sourceConfig as any);
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
    if (sourceType === SourceType.SAM_GOV) {
      return this.fetchSamGov(sourceConfig as any);
    }
    if (sourceType === SourceType.WEB_SEARCH) {
      return this.fetchWebSearch(sourceConfig as any);
    }
    if (String(sourceType) === 'DEVTO_SEARCH') {
      return this.fetchDevToSearch(sourceConfig as any);
    }
    if (String(sourceType) === 'GITLAB_SEARCH') {
      return this.fetchGitLabSearch(sourceConfig as any);
    }
    if (String(sourceType) === 'YOUTUBE_SEARCH') {
      return this.fetchYoutubeSearch(sourceConfig as any);
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

  private shouldExcludeAsLowSignal(
    sourceType: SourceType,
    title: string,
    text: string,
    matchedKeywordCount: number,
  ) {
    const typesWithStrongerNoiseFiltering = new Set<string>([
      SourceType.WEB_SEARCH,
      SourceType.RSS,
      SourceType.DISCOURSE,
      SourceType.HN_SEARCH,
      'DEVTO_SEARCH',
      'YOUTUBE_SEARCH',
    ]);

    if (!typesWithStrongerNoiseFiltering.has(String(sourceType))) {
      return false;
    }

    const combinedText = `${title} ${text}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!combinedText) return true;

    const strongIntentSignals = [
      /\b(looking for|recommend(?:ed)?|need help|need support|help needed|support needed)\b/i,
      /\b(consultant|agency|freelancer|contractor|implementation partner|vendor|specialist)\b/i,
      /\b(migration|integration|implementation|automation|revops|crm|devops|rescue)\b/i,
      /\b(urgent|blocked|stuck|breaking|outage|incident|failing|broken)\b/i,
      /\b(hire|hiring|who should we hire|partner)\b/i,
      /\b(google business profile|gbp|maps ranking|local seo|reviews? dropped|suspended listing|not getting calls|not getting leads)\b/i,
      /\b(plumber|hvac|electrician|roofer|cleaning service|pest control)\b.*\b(need|recommend|quote|book|hire|calls?)\b/i,
    ];

    const lowSignalPatterns = [
      /\b(show hn|launch(?:ing)? today|weekly roundup|newsletter|release notes?)\b/i,
      /\b(list of tools|best tools|top tools|tool stack|my side project)\b/i,
      /\b(free template|tutorial|course|boilerplate|open source release)\b/i,
      /\b(job opening|we are hiring|hiring engineer|careers page)\b/i,
    ];

    const hasStrongIntent = strongIntentSignals.some((pattern) => pattern.test(combinedText));
    const hasLowSignalPattern = lowSignalPatterns.some((pattern) => pattern.test(combinedText));
    const compactLength = combinedText.replace(/\s+/g, ' ').length;

    if (!hasStrongIntent && matchedKeywordCount < 2 && compactLength < 110) {
      return true;
    }

    if (!hasStrongIntent && hasLowSignalPattern) {
      return true;
    }

    return false;
  }

  private matchesConfiguredIntent(
    content: string,
    sourceType: SourceType,
    sourceConfig: Record<string, any>,
  ) {
    const queryDrivenTypes = new Set<string>([
      SourceType.REDDIT_SEARCH,
      SourceType.HN_SEARCH,
      SourceType.GITHUB_SEARCH,
      SourceType.STACKOVERFLOW_SEARCH,
      SourceType.SAM_GOV,
      SourceType.WEB_SEARCH,
      SourceType.DISCOURSE,
      'DEVTO_SEARCH',
      'GITLAB_SEARCH',
      'YOUTUBE_SEARCH',
    ]);

    if (!queryDrivenTypes.has(String(sourceType))) {
      return false;
    }

    const rawQuery = String(sourceConfig.query || '').trim().toLowerCase();
    if (!rawQuery) return false;

    if (this.matchesLooseSearchQuery(content, rawQuery)) {
      return true;
    }

    const stopWords = new Set(['and', 'or', 'for', 'the', 'with', 'from', 'into', 'that', 'this', 'your', 'need', 'looking']);
    const intentPattern = /\b(looking for|need help|need support|recommend|recommendation|hire|hiring|consultant|agency|expert|specialist|vendor|partner|migration|implementation|integration|setup|fix|support|rescue|audit)\b/i;
    const hasIntentLanguage = intentPattern.test(content);
    const clauses = rawQuery
      .split(/\s+OR\s+/i)
      .map((clause) => clause.replace(/[()"]/g, ' ').trim())
      .filter(Boolean);

    return clauses.some((clause) => {
      const tokens = clause
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !stopWords.has(token));

      if (!tokens.length) return false;

      const overlap = tokens.filter((token) => content.includes(token)).length;
      if (overlap >= Math.min(2, tokens.length)) return true;
      return hasIntentLanguage && overlap >= 1 && tokens.some((token) => token.length >= 6);
    });
  }

  private matchesLooseSearchQuery(text: string, query: string) {
    const clauses = query
      .split(/\s+OR\s+/i)
      .map((clause) => clause.replace(/[()"]/g, '').trim().toLowerCase())
      .filter(Boolean);

    if (!clauses.length) return true;
    return clauses.some((clause) => text.includes(clause));
  }

  private applySourceWeighting(
    classification: {
      isOpportunity: boolean;
      category: any;
      confidenceScore: number;
      whyItMatters: string;
      suggestedOutreach: string | null;
      suggestedReply: string | null;
      painPoint: string | null;
      urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'MIXED';
      conversationType: 'BUYER_REQUEST' | 'RECOMMENDATION' | 'PAIN_REPORT' | 'HIRING' | 'PARTNERSHIP' | 'TREND' | 'OTHER';
    },
    sourceType: SourceType,
    sourceConfig: Record<string, any>,
  ) {
    const sourceTypeWeights: Record<string, number> = {
      REDDIT: 1.05,
      REDDIT_SEARCH: 1.0,
      RSS: 0.95,
      DISCOURSE: 0.95,
      HN_SEARCH: 1.05,
      GITHUB_SEARCH: 0.95,
      STACKOVERFLOW_SEARCH: 0.9,
      SAM_GOV: 1.15,
      WEB_SEARCH: 0.85,
      DEVTO_SEARCH: 0.92,
      GITLAB_SEARCH: 0.95,
      YOUTUBE_SEARCH: 0.8,
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
