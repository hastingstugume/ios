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

  private fallbackClassify(title: string | null, text: string, keywords: string[]): ClassificationResult {
    const content = `${title || ''} ${text}`.toLowerCase();
    const buyingWords = ['looking for', 'need a', 'hire', 'budget', 'consultant', 'agency', 'vendor', 'implement'];
    const matchCount = buyingWords.filter((w) => content.includes(w)).length;
    const kwMatches = keywords.filter((k) => content.includes(k.toLowerCase())).length;
    const score = Math.min(95, (matchCount * 12) + (kwMatches * 8) + 20);
    const urgency = this.inferUrgency(content);
    const category = content.includes('recommend') ? SignalCategory.RECOMMENDATION_REQUEST
      : content.includes('hire') || content.includes('hiring') ? SignalCategory.HIRING_SIGNAL
      : content.includes('pain') || content.includes('problem') || content.includes('stuck') ? SignalCategory.PAIN_COMPLAINT
      : SignalCategory.BUYING_INTENT;

    return {
      isOpportunity: score > 50,
      category,
      confidenceScore: score,
      painPoint: this.buildPainPoint(title, text),
      urgency,
      sentiment: this.inferSentiment(content),
      conversationType: this.inferConversationType(category),
      whyItMatters: `Contains ${matchCount} buying intent signals, matches ${kwMatches} monitored keywords, and reflects ${urgency.toLowerCase()} urgency.`,
      suggestedOutreach: score > 60 ? 'Lead with a specific point of view on the problem they described and offer a low-friction next step.' : null,
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
}
