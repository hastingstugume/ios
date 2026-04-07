import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SignalCategory } from '@prisma/client';

export interface ClassificationResult {
  isOpportunity: boolean;
  category: SignalCategory;
  confidenceScore: number;
  whyItMatters: string;
  suggestedOutreach: string | null;
  suggestedReply: string | null;
  painPoint: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'MIXED';
  conversationType: 'BUYER_REQUEST' | 'RECOMMENDATION' | 'PAIN_REPORT' | 'HIRING' | 'PARTNERSHIP' | 'TREND' | 'OTHER';
}

export interface SourceSuggestionContext {
  organizationName: string;
  accountType: 'FREELANCER' | 'BUSINESS' | 'UNKNOWN';
  businessFocus?: string | null;
  targetAudience?: string | null;
  trackedKeywords: string[];
  negativeKeywords: string[];
}

export interface SourceSuggestionPack {
  name: string;
  audience: string;
  description: string;
  recommendedKeywords: string[];
  recommendedNegativeKeywords: string[];
  sources: Array<{
    name: string;
    type: 'REDDIT_SEARCH' | 'WEB_SEARCH' | 'STACKOVERFLOW_SEARCH' | 'GITHUB_SEARCH' | 'HN_SEARCH' | 'RSS' | 'DISCOURSE' | 'DEVTO_SEARCH' | 'GITLAB_SEARCH' | 'YOUTUBE_SEARCH';
    config: Record<string, any>;
  }>;
}

export interface SourceIntelligenceContext {
  workspaceName: string;
  trackedKeywords: string[];
  negativeKeywords: string[];
  sources: Array<{
    sourceId: string;
    name: string;
    type: string;
    status: 'ACTIVE' | 'PAUSED' | 'ERROR';
    totalSignals: number;
    last7dSignals: number;
    highConfidenceSignals: number;
    pipelineSignals: number;
    savedSignals: number;
    healthScore: number;
    healthLabel: string;
    errorMessage?: string | null;
  }>;
}

export interface SourceIntelligenceReport {
  summary: string;
  weeklySignalGoal: number;
  recommendations: Array<{
    sourceName: string;
    action: 'SCALE' | 'TUNE' | 'PAUSE' | 'FIX';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
    nextSteps: string[];
  }>;
  globalActions: string[];
  generatedBy: 'ai' | 'fallback';
}

const SYSTEM_PROMPT = `You are a B2B lead qualification expert. Your job is to analyze public internet posts and determine if they represent a genuine business opportunity for AI automation agencies, DevOps consultants, software implementation partners, or B2B technical service firms.

Analyze the post and return ONLY a valid JSON object with these exact fields:
{
  "isOpportunity": boolean,
  "category": one of: "BUYING_INTENT" | "RECOMMENDATION_REQUEST" | "PAIN_COMPLAINT" | "HIRING_SIGNAL" | "PARTNERSHIP_INQUIRY" | "MARKET_TREND" | "OTHER",
  "confidenceScore": integer 0-100,
  "painPoint": "single-sentence summary of the concrete pain or buyer need, null if none",
  "urgency": one of: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "sentiment": one of: "NEGATIVE" | "NEUTRAL" | "POSITIVE" | "MIXED",
  "conversationType": one of: "BUYER_REQUEST" | "RECOMMENDATION" | "PAIN_REPORT" | "HIRING" | "PARTNERSHIP" | "TREND" | "OTHER",
  "whyItMatters": "1-2 sentence explanation of why this is or isn't valuable",
  "suggestedOutreach": "1-2 sentence outreach suggestion if applicable, null if not an opportunity",
  "suggestedReply": "short, source-appropriate first reply or DM opener if applicable, null if not an opportunity"
}

Scoring guide:
- 90-100: Clear buying intent with budget/timeline, explicit ask for services
- 75-89: Strong signals of need, open to vendors/consultants
- 60-74: Moderate signals, possible opportunity with follow-up
- 40-59: Weak signals, mostly informational
- 0-39: Not an opportunity

Return ONLY the JSON. No preamble, no explanation, no markdown.`;

const SOURCE_SUGGESTION_SYSTEM_PROMPT = `You design source templates for a buyer-intent monitoring product used by agencies, consultancies, and freelancers.

Return ONLY a valid JSON array with exactly 3 template packs. Each item must match:
{
  "name": "short niche-specific pack name",
  "audience": "who this pack is for",
  "description": "1-2 sentence explanation of the opportunity pattern",
  "recommendedKeywords": ["3-6 tracked keywords"],
  "recommendedNegativeKeywords": ["2-5 negative keywords"],
  "sources": [
    {
      "name": "source display name",
      "type": one of "REDDIT_SEARCH" | "WEB_SEARCH" | "STACKOVERFLOW_SEARCH" | "GITHUB_SEARCH" | "HN_SEARCH" | "RSS" | "DISCOURSE" | "DEVTO_SEARCH" | "GITLAB_SEARCH" | "YOUTUBE_SEARCH",
      "config": { source config object }
    }
  ]
}

Rules:
- Make the packs meaningfully different from each other.
- Optimize for discovering buying intent, recommendation requests, and implementation pain.
- Use 3 or 4 sources per pack.
- Prefer search-driven sources over direct subreddit-only feeds unless a feed is clearly strong.
- Make queries specific, commercial, and relevant to the business context.
- Keep recommended keywords concise and high-signal.
- Negative keywords should reduce noise like jobs, courses, newsletters, and hobby traffic where relevant.
- Return valid JSON only.`;

const SOURCE_INTELLIGENCE_SYSTEM_PROMPT = `You are an AI advisor for a lead discovery product.

Given source performance metrics, return ONLY valid JSON with:
{
  "summary": "1-2 sentence executive summary focused on outcomes",
  "weeklySignalGoal": number,
  "recommendations": [
    {
      "sourceName": "exact source name from input",
      "action": one of "SCALE" | "TUNE" | "PAUSE" | "FIX",
      "priority": one of "HIGH" | "MEDIUM" | "LOW",
      "reason": "short reason tied to metrics",
      "nextSteps": ["2-4 concrete changes"]
    }
  ],
  "globalActions": ["2-4 cross-workspace actions"]
}

Rules:
- Keep recommendations practical and specific.
- Prefer fixing and tuning over pausing unless the source is clearly noisy.
- If a source has errors, include a FIX recommendation.
- Reference outcomes: more high-confidence signals, pipeline movement, less noise.
- Return JSON only.`;

@Injectable()
export class ClassificationService {
  private client: OpenAI | null = null;
  private readonly logger = new Logger(ClassificationService.name);

  constructor(private config: ConfigService) {
    const apiKey = config.get('AI_API_KEY');
    if (apiKey && !apiKey.startsWith('sk-replace')) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.get('AI_PROVIDER_BASE_URL', 'https://api.openai.com/v1'),
      });
    } else {
      this.logger.warn('AI classification disabled — set AI_API_KEY to enable');
    }
  }

  async classify(title: string | null, text: string, keywords: string[]): Promise<ClassificationResult> {
    if (!this.client) {
      return this.fallbackClassify(title, text, keywords);
    }

    const userPrompt = `Keywords being monitored: ${keywords.join(', ')}

Post title: ${title || '(no title)'}
Post content: ${text.slice(0, 2000)}

Classify this post.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        max_tokens: this.config.get('AI_MAX_TOKENS', 512),
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      return {
        isOpportunity: Boolean(parsed.isOpportunity),
        category: parsed.category as SignalCategory || SignalCategory.OTHER,
        confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 0)),
        painPoint: parsed.painPoint ? String(parsed.painPoint) : null,
        urgency: this.normalizeUrgency(parsed.urgency),
        sentiment: this.normalizeSentiment(parsed.sentiment),
        conversationType: this.normalizeConversationType(parsed.conversationType),
        whyItMatters: String(parsed.whyItMatters || ''),
        suggestedOutreach: parsed.suggestedOutreach || null,
        suggestedReply: parsed.suggestedReply || null,
      };
    } catch (err) {
      this.logger.error('Classification failed, using fallback', err);
      return this.fallbackClassify(title, text, keywords);
    }
  }

  async generateSourceSuggestions(context: SourceSuggestionContext): Promise<SourceSuggestionPack[]> {
    if (!this.client) {
      return this.buildFallbackSourceSuggestions(context);
    }

    const userPrompt = `Business context:
- Organization/workspace: ${context.organizationName}
- Account type: ${context.accountType}
- Business focus: ${context.businessFocus || 'not provided'}
- Target audience: ${context.targetAudience || 'not provided'}
- Tracked keywords: ${context.trackedKeywords.join(', ') || 'none yet'}
- Negative keywords: ${context.negativeKeywords.join(', ') || 'none yet'}

Create three source template packs tailored for this workspace.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        max_tokens: this.config.get('AI_MAX_TOKENS', 512) * 3,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SOURCE_SUGGESTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = response.choices[0]?.message?.content || '[]';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!Array.isArray(parsed)) {
        return this.buildFallbackSourceSuggestions(context);
      }

      const normalized = parsed
        .map((item: unknown) => this.normalizeSourceSuggestionPack(item))
        .filter((item): item is SourceSuggestionPack => Boolean(item));

      return normalized.length ? normalized.slice(0, 3) : this.buildFallbackSourceSuggestions(context);
    } catch (err) {
      this.logger.error('Source suggestion generation failed, using fallback', err);
      return this.buildFallbackSourceSuggestions(context);
    }
  }

  async generateSourceIntelligence(context: SourceIntelligenceContext): Promise<SourceIntelligenceReport> {
    if (!this.client) {
      return this.buildFallbackSourceIntelligence(context);
    }

    const sourceLines = context.sources.map((source) =>
      [
        `- ${source.name} (${source.type}, ${source.status})`,
        `  last7d=${source.last7dSignals}, highConfidence=${source.highConfidenceSignals}, pipeline=${source.pipelineSignals}, saved=${source.savedSignals}, total=${source.totalSignals}, health=${source.healthScore}/${source.healthLabel}`,
        source.errorMessage ? `  error=${source.errorMessage}` : '',
      ].filter(Boolean).join('\n'),
    ).join('\n');

    const userPrompt = `Workspace: ${context.workspaceName}
Tracked keywords: ${context.trackedKeywords.join(', ') || 'none'}
Negative keywords: ${context.negativeKeywords.join(', ') || 'none'}

Source performance:
${sourceLines || '- no sources configured'}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        max_tokens: this.config.get('AI_MAX_TOKENS', 512) * 2,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SOURCE_INTELLIGENCE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const normalized = this.normalizeSourceIntelligenceReport(parsed, context.sources);
      if (normalized) {
        return { ...normalized, generatedBy: 'ai' };
      }

      return this.buildFallbackSourceIntelligence(context);
    } catch (err) {
      this.logger.error('Source intelligence generation failed, using fallback', err);
      return this.buildFallbackSourceIntelligence(context);
    }
  }

  private fallbackClassify(title: string | null, text: string, keywords: string[]): ClassificationResult {
    const content = `${title || ''} ${text}`.toLowerCase();
    const buyingWords = [
      'looking for',
      'need a',
      'need help',
      'need support',
      'hire',
      'budget',
      'consultant',
      'agency',
      'vendor',
      'implementation partner',
      'not getting leads',
      'maps ranking',
      'google business profile',
      'review management',
      'booked jobs',
      'quote requests',
    ];
    const noiseWords = [
      'job opening',
      'we are hiring',
      'hiring engineer',
      'tutorial',
      'course',
      'newsletter',
      'show hn',
      'side project',
      'release notes',
      'free template',
    ];
    const localPainPattern = /\b(google business profile|gbp|maps ranking|not getting calls|not getting leads|reviews? dropped|local seo|map pack|suspended listing|profile suspended)\b/i;
    const ownerIntentPattern = /\b(plumber|hvac|electrician|roofer|cleaning service|contractor|home services?)\b/i;
    const urgency = this.inferUrgency(content);
    const urgencyBoost = urgency === 'HIGH' ? 8 : urgency === 'MEDIUM' ? 3 : 0;
    const localIntentBoost = localPainPattern.test(content) ? 10 : 0;
    const ownerDemandBoost = ownerIntentPattern.test(content) && /\b(need|looking for|recommend|hire|quotes?|bookings?|calls?)\b/i.test(content) ? 8 : 0;
    const matchCount = buyingWords.filter((word) => content.includes(word)).length;
    const noiseCount = noiseWords.filter((word) => content.includes(word)).length;
    const kwMatches = keywords.filter((k) => content.includes(k.toLowerCase())).length;
    const category = this.detectFallbackCategory(content);
    const score = Math.min(
      95,
      Math.max(
        0,
        18
          + (matchCount * 10)
          + (kwMatches * 8)
          + urgencyBoost
          + localIntentBoost
          + ownerDemandBoost
          - (noiseCount * 12),
      ),
    );
    const whyItMattersParts = [
      `Detected ${matchCount} intent signal${matchCount === 1 ? '' : 's'}`,
      kwMatches > 0 ? `matched ${kwMatches} tracked keyword${kwMatches === 1 ? '' : 's'}` : null,
      localIntentBoost > 0 ? 'found local visibility/reputation pain' : null,
      ownerDemandBoost > 0 ? 'found owner/operator demand context' : null,
      noiseCount > 0 ? `filtered ${noiseCount} noise marker${noiseCount === 1 ? '' : 's'}` : null,
      `urgency is ${urgency.toLowerCase()}`,
    ].filter(Boolean).join(', ');
    const suggestedOutreach = score > 60
      ? localIntentBoost > 0
        ? 'Lead with a quick visibility-and-reviews diagnostic, quantify likely missed calls, and propose one concrete 7-day fix.'
        : 'Lead with a specific point of view on the problem they described and offer a low-friction next step.'
      : null;

    return {
      isOpportunity: score > 50,
      category,
      confidenceScore: score,
      painPoint: this.buildPainPoint(title, text),
      urgency,
      sentiment: this.inferSentiment(content),
      conversationType: this.inferConversationType(category),
      whyItMatters: whyItMattersParts,
      suggestedOutreach,
      suggestedReply: score > 60 ? this.buildSuggestedReply(title, text, category) : null,
    };
  }

  normalize(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/https?:\/\/\S+/g, '[link]')
      .trim()
      .slice(0, 1000);
  }

  private normalizeUrgency(value: unknown): ClassificationResult['urgency'] {
    return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(value))
      ? value as ClassificationResult['urgency']
      : 'MEDIUM';
  }

  private normalizeSentiment(value: unknown): ClassificationResult['sentiment'] {
    return ['NEGATIVE', 'NEUTRAL', 'POSITIVE', 'MIXED'].includes(String(value))
      ? value as ClassificationResult['sentiment']
      : 'NEUTRAL';
  }

  private normalizeConversationType(value: unknown): ClassificationResult['conversationType'] {
    return ['BUYER_REQUEST', 'RECOMMENDATION', 'PAIN_REPORT', 'HIRING', 'PARTNERSHIP', 'TREND', 'OTHER'].includes(String(value))
      ? value as ClassificationResult['conversationType']
      : 'OTHER';
  }

  private inferUrgency(content: string): ClassificationResult['urgency'] {
    if (/(asap|urgent|immediately|today|this week|blocked|emergency|right away)/i.test(content)) return 'HIGH';
    if (/(deadline|soon|quickly|fast|need help now)/i.test(content)) return 'MEDIUM';
    return 'LOW';
  }

  private inferSentiment(content: string): ClassificationResult['sentiment'] {
    const negative = /(frustrated|blocked|issue|problem|stuck|pain|urgent|failing|broken)/i.test(content);
    const positive = /(excited|love|great|happy|successful|improved)/i.test(content);
    if (negative && positive) return 'MIXED';
    if (negative) return 'NEGATIVE';
    if (positive) return 'POSITIVE';
    return 'NEUTRAL';
  }

  private inferConversationType(category: SignalCategory): ClassificationResult['conversationType'] {
    if (category === SignalCategory.BUYING_INTENT) return 'BUYER_REQUEST';
    if (category === SignalCategory.RECOMMENDATION_REQUEST) return 'RECOMMENDATION';
    if (category === SignalCategory.PAIN_COMPLAINT) return 'PAIN_REPORT';
    if (category === SignalCategory.HIRING_SIGNAL) return 'HIRING';
    if (category === SignalCategory.PARTNERSHIP_INQUIRY) return 'PARTNERSHIP';
    if (category === SignalCategory.MARKET_TREND) return 'TREND';
    return 'OTHER';
  }

  private detectFallbackCategory(content: string): SignalCategory {
    if (/\b(recommend|recommendation|who should we hire|any agency suggestions?)\b/i.test(content)) {
      return SignalCategory.RECOMMENDATION_REQUEST;
    }
    if (/\b(hiring|job opening|role open|career)\b/i.test(content) && !/\b(need help|looking for|recommend|consultant|agency)\b/i.test(content)) {
      return SignalCategory.HIRING_SIGNAL;
    }
    if (/\b(not getting leads|not getting calls|dropped|suspended|problem|issue|stuck|broken|failing|reviews? dropped)\b/i.test(content)) {
      return SignalCategory.PAIN_COMPLAINT;
    }
    if (/\b(looking for|need help|need support|consultant|agency|vendor|partner|quote|bookings?)\b/i.test(content)) {
      return SignalCategory.BUYING_INTENT;
    }
    return SignalCategory.OTHER;
  }

  private buildPainPoint(title: string | null, text: string) {
    const raw = `${title ? `${title}. ` : ''}${text}`.replace(/\s+/g, ' ').trim();
    if (!raw) return null;
    return raw.slice(0, 180);
  }

  private buildSuggestedReply(title: string | null, text: string, category: SignalCategory) {
    const subject = (title || text).replace(/\s+/g, ' ').trim().slice(0, 90);
    if (category === SignalCategory.RECOMMENDATION_REQUEST) {
      return `We help teams solve problems like "${subject}". Happy to share what has worked and point you to a few practical options.`;
    }
    if (category === SignalCategory.HIRING_SIGNAL) {
      return `If you need help faster than a full hiring cycle allows, we can share how we support teams on projects like "${subject}".`;
    }
    return `This sounds close to work we do around "${subject}". Happy to share a practical approach or a couple of examples if useful.`;
  }

  private normalizeSourceSuggestionPack(input: any): SourceSuggestionPack | null {
    if (!input || typeof input !== 'object') return null;
    const sources = Array.isArray(input.sources)
      ? input.sources
          .map((source: unknown) => {
            if (!source || typeof source !== 'object') return null;
            const candidate = source as { type?: unknown; name?: unknown; config?: unknown };
            const type = String(candidate.type || '').toUpperCase();
            if (!['REDDIT_SEARCH', 'WEB_SEARCH', 'STACKOVERFLOW_SEARCH', 'GITHUB_SEARCH', 'HN_SEARCH', 'RSS', 'DISCOURSE', 'DEVTO_SEARCH', 'GITLAB_SEARCH', 'YOUTUBE_SEARCH'].includes(type)) {
              return null;
            }

            return {
              name: String(candidate.name || 'Suggested source').slice(0, 80),
              type: type as SourceSuggestionPack['sources'][number]['type'],
              config: candidate.config && typeof candidate.config === 'object' ? candidate.config as Record<string, any> : {},
            };
          })
          .filter(Boolean)
      : [];

    if (!sources.length) return null;

    return {
      name: String(input.name || 'Suggested template').slice(0, 80),
      audience: String(input.audience || 'Teams monitoring public buyer intent').slice(0, 180),
      description: String(input.description || 'AI-generated template based on your workspace context.').slice(0, 320),
      recommendedKeywords: this.normalizeStringArray(input.recommendedKeywords, 6),
      recommendedNegativeKeywords: this.normalizeStringArray(input.recommendedNegativeKeywords, 6),
      sources,
    };
  }

  private normalizeSourceIntelligenceReport(
    input: any,
    sourceSnapshots: SourceIntelligenceContext['sources'],
  ): Omit<SourceIntelligenceReport, 'generatedBy'> | null {
    if (!input || typeof input !== 'object') return null;
    const sourceNameSet = new Set(sourceSnapshots.map((source) => source.name.toLowerCase()));

    const recommendations = Array.isArray(input.recommendations)
      ? input.recommendations
          .map((recommendation: unknown) => {
            if (!recommendation || typeof recommendation !== 'object') return null;
            const candidate = recommendation as {
              sourceName?: unknown;
              action?: unknown;
              priority?: unknown;
              reason?: unknown;
              nextSteps?: unknown;
            };
            const sourceName = String(candidate.sourceName || '').trim();
            if (!sourceName || !sourceNameSet.has(sourceName.toLowerCase())) return null;

            const action = String(candidate.action || '').toUpperCase();
            const priority = String(candidate.priority || '').toUpperCase();
            if (!['SCALE', 'TUNE', 'PAUSE', 'FIX'].includes(action)) return null;
            if (!['HIGH', 'MEDIUM', 'LOW'].includes(priority)) return null;

            const nextSteps = this.normalizeStringArray(candidate.nextSteps, 4);
            return {
              sourceName,
              action: action as SourceIntelligenceReport['recommendations'][number]['action'],
              priority: priority as SourceIntelligenceReport['recommendations'][number]['priority'],
              reason: String(candidate.reason || '').trim().slice(0, 280),
              nextSteps,
            };
          })
          .filter(Boolean)
      : [];

    if (!recommendations.length) return null;

    const weeklySignalGoalRaw = Number(input.weeklySignalGoal);
    const weeklySignalGoal = Number.isFinite(weeklySignalGoalRaw)
      ? Math.max(4, Math.min(200, Math.round(weeklySignalGoalRaw)))
      : 10;

    return {
      summary: String(input.summary || 'Source performance summary generated from current workspace metrics.')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320),
      weeklySignalGoal,
      recommendations: recommendations.slice(0, 8),
      globalActions: this.normalizeStringArray(input.globalActions, 4),
    };
  }

  private normalizeStringArray(input: unknown, maxItems = 6) {
    if (!Array.isArray(input)) return [];
    return input
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }

  private buildFallbackSourceSuggestions(context: SourceSuggestionContext): SourceSuggestionPack[] {
    const focus = this.getSuggestionFocus(context);
    const audience = (context.targetAudience || (context.accountType === 'FREELANCER' ? 'buyers looking for a specialist' : 'teams looking for outside help')).trim();
    const baseKeywords = context.trackedKeywords.slice(0, 4);
    const defaultNegatives = context.negativeKeywords.slice(0, 3);

    const commonNegatives = Array.from(new Set([...defaultNegatives, 'job', 'course', 'newsletter'])).slice(0, 5);

    if (context.accountType === 'FREELANCER') {
      return [
        {
          name: 'Freelancer quick wins',
          audience: `Solo operators targeting ${audience}`,
          description: `Short-cycle recommendation and implementation requests related to ${focus}.`,
          recommendedKeywords: Array.from(new Set([...baseKeywords, 'freelancer', 'consultant', 'implementation help'])).slice(0, 5),
          recommendedNegativeKeywords: commonNegatives,
          sources: [
            { name: 'Ask HN freelancer demand', type: 'HN_SEARCH', config: { query: `"need freelancer" OR "looking for consultant" OR "recommend ${focus}"`, tags: 'story,comment', sourceWeight: 1.05 } },
            { name: 'Web search specialist requests', type: 'WEB_SEARCH', config: { query: `"recommend ${focus}" OR "need help with ${focus}"`, domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'], excludeTerms: commonNegatives, sourceWeight: 0.95 } },
            { name: 'Dev.to implementation pain', type: 'DEVTO_SEARCH', config: { query: `"need help" OR migration OR consultant OR ${focus}`, tags: ['ai', 'devops', 'webdev'], sourceWeight: 0.95 } },
            { name: 'Stack Overflow buyer pain', type: 'STACKOVERFLOW_SEARCH', config: { query: `"need help" OR consultant OR migration`, stackSort: 'activity', sourceWeight: 0.9 } },
          ],
        },
        {
          name: 'Urgent technical support',
          audience: `Founders and operators blocked on ${focus}`,
          description: 'Higher-urgency support and rescue opportunities that can convert quickly.',
          recommendedKeywords: Array.from(new Set([...baseKeywords, 'urgent help', 'fix', 'migration'])).slice(0, 5),
          recommendedNegativeKeywords: commonNegatives,
          sources: [
            { name: 'Ask HN urgent blockers', type: 'HN_SEARCH', config: { query: `"urgent" ${focus} OR "blocked" ${focus} OR "need help now"`, tags: 'story,comment', sourceWeight: 1.05 } },
            { name: 'GitLab public issue blockers', type: 'GITLAB_SEARCH', config: { query: `blocked OR incident OR migration OR support`, scope: 'issues', sourceWeight: 0.95 } },
            { name: 'Dev.to urgent engineering posts', type: 'DEVTO_SEARCH', config: { query: `incident OR blocked OR "need support" OR ${focus}`, tags: ['devops', 'programming', 'backend'], sourceWeight: 0.9 } },
            { name: 'GitHub implementation pain', type: 'GITHUB_SEARCH', config: { query: `"need support" OR "looking for help" OR migration`, contentType: 'issues', sourceWeight: 0.85 } },
          ],
        },
        {
          name: 'Recommendation-led outreach',
          audience: `Buyers asking peers who to hire for ${focus}`,
          description: 'Recommendation and vendor-selection conversations where being mentioned early matters.',
          recommendedKeywords: Array.from(new Set([...baseKeywords, 'recommend', 'agency', 'expert'])).slice(0, 5),
          recommendedNegativeKeywords: commonNegatives,
          sources: [
            { name: 'Ask HN recommendation requests', type: 'HN_SEARCH', config: { query: `"recommend" ${focus} OR "who should I hire" consultant`, tags: 'story,comment', sourceWeight: 1.05 } },
            { name: 'Web vendor search', type: 'WEB_SEARCH', config: { query: `"recommend ${focus} consultant" OR "best ${focus} agency"`, domains: ['news.ycombinator.com', 'github.com'], excludeTerms: commonNegatives, sourceWeight: 0.9 } },
            { name: 'Dev.to vendor comparisons', type: 'DEVTO_SEARCH', config: { query: `"recommend" OR "best" OR consultant OR agency`, tags: ['career', 'software'], sourceWeight: 0.85 } },
            { name: 'HN vendor comparisons', type: 'HN_SEARCH', config: { query: `${focus} consultant OR agency OR recommendation`, tags: 'story', sourceWeight: 0.85 } },
          ],
        },
      ];
    }

    return [
      {
        name: 'Buyer intent starter',
        audience: `Businesses serving ${audience}`,
        description: `Commercial requests and recommendation threads related to ${focus}.`,
        recommendedKeywords: Array.from(new Set([...baseKeywords, 'consultant', 'agency', 'implementation partner'])).slice(0, 5),
        recommendedNegativeKeywords: commonNegatives,
        sources: [
          { name: 'Ask HN buyer intent', type: 'HN_SEARCH', config: { query: `"looking for" consultant OR "need help" ${focus} OR "recommend" agency`, tags: 'story,comment', sourceWeight: 1.05 } },
          { name: 'Web buyer search', type: 'WEB_SEARCH', config: { query: `"need ${focus} help" OR "recommend ${focus} consultant"`, domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'], excludeTerms: commonNegatives, sourceWeight: 0.95 } },
          { name: 'Dev.to buyer intent', type: 'DEVTO_SEARCH', config: { query: `"need help" OR "looking for" OR consultant OR agency`, tags: ['devops', 'saas', 'webdev'], sourceWeight: 0.9 } },
          { name: 'HN buying signals', type: 'HN_SEARCH', config: { query: `${focus} consultant OR implementation OR agency`, tags: 'story,comment', sourceWeight: 0.9 } },
        ],
      },
      {
        name: 'Implementation pain monitor',
        audience: `Teams actively struggling with ${focus}`,
        description: 'Operational pain and migration problems that often convert into project work.',
        recommendedKeywords: Array.from(new Set([...baseKeywords, 'migration', 'integration', 'automation'])).slice(0, 5),
        recommendedNegativeKeywords: commonNegatives,
        sources: [
          { name: 'Stack Overflow implementation pain', type: 'STACKOVERFLOW_SEARCH', config: { query: `"need help" OR "production issue" OR migration OR consultant`, stackSort: 'activity', sourceWeight: 0.95 } },
          { name: 'GitHub community pain', type: 'GITHUB_SEARCH', config: { query: `"looking for help" OR migration OR consultant`, contentType: 'discussions', sourceWeight: 0.85 } },
          { name: 'Dev.to implementation friction', type: 'DEVTO_SEARCH', config: { query: `migration OR incident OR "need support" OR ${focus}`, tags: ['programming', 'backend'], sourceWeight: 0.9 } },
          { name: 'YouTube implementation pressure', type: 'YOUTUBE_SEARCH', config: { query: `"migration failed" OR "need help" OR "integration issue"`, postedWithinDays: 30, order: 'date', sourceWeight: 0.85 } },
        ],
      },
      {
        name: 'Decision-stage demand',
        audience: `Operators evaluating vendors for ${focus}`,
        description: 'Conversations where buyers are comparing providers or asking who to trust.',
        recommendedKeywords: Array.from(new Set([...baseKeywords, 'vendor', 'who to hire', 'specialist'])).slice(0, 5),
        recommendedNegativeKeywords: commonNegatives,
        sources: [
          { name: 'Ask HN who-to-hire threads', type: 'HN_SEARCH', config: { query: `"who should I hire" OR "best agency" ${focus} OR "recommend consultant"`, tags: 'story,comment', sourceWeight: 1.05 } },
          { name: 'Web recommendation search', type: 'WEB_SEARCH', config: { query: `"best ${focus} agency" OR "recommend ${focus} consultant"`, domains: ['news.ycombinator.com', 'github.com'], excludeTerms: commonNegatives, sourceWeight: 0.9 } },
          { name: 'Dev.to recommendation signals', type: 'DEVTO_SEARCH', config: { query: `"recommend" OR "best" OR consultant OR partner`, tags: ['saas', 'startup'], sourceWeight: 0.85 } },
          { name: 'HN tool/vendor evaluation', type: 'HN_SEARCH', config: { query: `${focus} OR vendor OR implementation partner`, tags: 'story', sourceWeight: 0.85 } },
        ],
      },
    ];
  }

  private buildFallbackSourceIntelligence(context: SourceIntelligenceContext): SourceIntelligenceReport {
    if (!context.sources.length) {
      return {
        summary: 'No sources are configured yet. Add 2-3 search-driven sources to start generating consistent weekly opportunities.',
        weeklySignalGoal: 6,
        recommendations: [],
        globalActions: [
          'Add one high-intent search source focused on recommendation or hiring language.',
          'Add one pain-monitor source focused on migration, outage, or blocker language.',
          'Add 5-8 tracked keywords and 3-5 negative keywords before the next fetch cycle.',
        ],
        generatedBy: 'fallback',
      };
    }

    const recommendations = context.sources
      .map((source) => {
        if (source.status === 'ERROR') {
          return {
            sourceName: source.name,
            action: 'FIX' as const,
            priority: 'HIGH' as const,
            reason: 'Source fetches are failing, so this channel cannot produce opportunities.',
            nextSteps: [
              'Open source settings and fix invalid credentials or query fields.',
              'Run a test fetch and confirm at least 1 matching result.',
              'Resume the source after the next successful fetch.',
            ],
          };
        }

        if (source.last7dSignals >= 6 && (source.highConfidenceSignals >= 2 || source.pipelineSignals >= 1)) {
          return {
            sourceName: source.name,
            action: 'SCALE' as const,
            priority: 'HIGH' as const,
            reason: 'This source is producing both volume and conversion-quality signals.',
            nextSteps: [
              'Clone this source with one adjacent query variation.',
              'Increase source weight slightly to prioritize in ranking.',
              'Create an alert rule for high-confidence hits from this source.',
            ],
          };
        }

        if (source.last7dSignals === 0) {
          return {
            sourceName: source.name,
            action: 'TUNE' as const,
            priority: 'MEDIUM' as const,
            reason: 'The source is active but not producing fresh opportunities this week.',
            nextSteps: [
              'Rewrite query with stronger buyer language like "looking for", "need help", or "recommend".',
              'Reduce noisy exclusions that may be over-filtering valid demand.',
              'Test with broader tags/domains, then re-tighten after signals appear.',
            ],
          };
        }

        if (source.last7dSignals >= 8 && source.highConfidenceSignals === 0 && source.pipelineSignals === 0) {
          return {
            sourceName: source.name,
            action: 'PAUSE' as const,
            priority: 'LOW' as const,
            reason: 'High activity with no quality outcomes suggests this source is noisy.',
            nextSteps: [
              'Pause temporarily and compare pipeline impact after one week.',
              'If retained, narrow the query to intent-heavy phrases only.',
              'Increase negative keywords to remove recurring low-signal chatter.',
            ],
          };
        }

        return {
          sourceName: source.name,
          action: 'TUNE' as const,
          priority: 'MEDIUM' as const,
          reason: 'Source shows some activity but needs refinement for higher-intent outcomes.',
          nextSteps: [
            'Add one query variant focused on pain + urgency language.',
            'Tune source weight based on confidence and conversion quality.',
            'Review top 5 matches and add exclusions for repeated noise patterns.',
          ],
        };
      })
      .slice(0, 8);

    const totalLast7d = context.sources.reduce((sum, source) => sum + source.last7dSignals, 0);
    const weeklySignalGoal = Math.max(6, Math.min(200, Math.round(totalLast7d * 1.35 + 4)));
    const highPriorityCount = recommendations.filter((recommendation) => recommendation.priority === 'HIGH').length;

    return {
      summary: highPriorityCount > 0
        ? `You have ${highPriorityCount} source${highPriorityCount === 1 ? '' : 's'} that can move outcomes quickly this week. Prioritize fix/scale actions first, then tune the rest for cleaner intent.`
        : 'Your source mix is active, but tuning is needed to consistently produce high-intent opportunities.',
      weeklySignalGoal,
      recommendations,
      globalActions: [
        'Focus weekly reviews on high-confidence and pipeline-moving signals, not just total volume.',
        'Refresh weak queries every 7-10 days using real phrases from closed-won or replied signals.',
        'Keep negative keywords updated to suppress recurring low-signal content.',
      ],
      generatedBy: 'fallback',
    };
  }

  private getSuggestionFocus(context: SourceSuggestionContext) {
    const explicitFocus = (context.businessFocus || context.trackedKeywords[0] || '').trim();
    if (explicitFocus) return explicitFocus;
    if (context.accountType === 'FREELANCER') return 'consulting support';
    return 'technical implementation';
  }
}
