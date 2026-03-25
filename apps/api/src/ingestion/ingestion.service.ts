import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../classification/classification.service';
import { ConfigService } from '@nestjs/config';

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
      let items: Array<{ externalId: string; title?: string; text: string; url: string; author?: string; publishedAt?: Date }> = [];

      if (source.type === 'REDDIT') {
        items = await this.fetchReddit(source.config as any);
      } else if (source.type === 'RSS') {
        items = await this.fetchRSS(source.config as any);
      }

      await this.processItems(source.id, source.organizationId, items);
      await this.prisma.source.update({
        where: { id: sourceId },
        data: { lastFetchedAt: new Date(), errorMessage: null },
      });
    } catch (err: any) {
      this.logger.error(`Failed to fetch source ${sourceId}: ${err.message}`);
      await this.prisma.source.update({
        where: { id: sourceId },
        data: { errorMessage: err.message, status: 'ERROR' },
      });
    }
  }

  private async fetchReddit(config: { subreddit: string; limit?: number }) {
    const { subreddit, limit = 25 } = config;
    const clientId = this.config.get('REDDIT_CLIENT_ID', '');
    const clientSecret = this.config.get('REDDIT_CLIENT_SECRET', '');
    const userAgent = this.config.get('REDDIT_USER_AGENT', 'InternetOpportunityScanner/0.1');

    // If no real credentials, return empty (seed data covers demo)
    if (!clientId || clientId === 'replace-with-client-id') {
      this.logger.warn(`Reddit credentials not configured, skipping r/${subreddit}`);
      return [];
    }

    try {
      // Get access token
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

      const res = await fetch(
        `https://oauth.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': userAgent } },
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

  private async processItems(
    sourceId: string,
    orgId: string,
    items: Array<{ externalId: string; title?: string; text: string; url: string; author?: string; publishedAt?: Date }>,
  ) {
    const keywords = await this.prisma.keyword.findMany({
      where: { organizationId: orgId, isActive: true },
    });
    const kwPhrases = keywords.map((k) => k.phrase);

    for (const item of items) {
      const content = `${item.title || ''} ${item.text}`.toLowerCase();
      const matchedKeywords = keywords.filter((k) => content.includes(k.phrase.toLowerCase()));
      if (matchedKeywords.length === 0) continue;

      const existing = await this.prisma.signal.findUnique({
        where: { organizationId_sourceId_externalId: { organizationId: orgId, sourceId, externalId: item.externalId } },
      });
      if (existing) continue;

      const normalizedText = this.classification.normalize(item.text);
      const classification = await this.classification.classify(item.title || null, item.text, kwPhrases);

      const signal = await this.prisma.signal.create({
        data: {
          organizationId: orgId,
          sourceId,
          externalId: item.externalId,
          sourceUrl: item.url,
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
          classificationRaw: classification as any,
        },
      });

      for (const kw of matchedKeywords) {
        await this.prisma.signalKeyword.create({
          data: { signalId: signal.id, keywordId: kw.id },
        }).catch(() => {});
      }

      // Queue alerts check
      await this.ingestionQueue.add('check-alerts', {
        orgId,
        signalId: signal.id,
        confidenceScore: classification.confidenceScore,
        category: classification.category,
      });
    }
  }

  async triggerManualFetch(orgId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({ where: { id: sourceId, organizationId: orgId } });
    if (!source) throw new Error('Source not found');
    await this.ingestionQueue.add('fetch-source', { sourceId });
    return { queued: true };
  }
}
