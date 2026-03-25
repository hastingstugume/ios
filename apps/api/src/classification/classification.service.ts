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
}

const SYSTEM_PROMPT = `You are a B2B lead qualification expert. Your job is to analyze public internet posts and determine if they represent a genuine business opportunity for AI automation agencies, DevOps consultants, software implementation partners, or B2B technical service firms.

Analyze the post and return ONLY a valid JSON object with these exact fields:
{
  "isOpportunity": boolean,
  "category": one of: "BUYING_INTENT" | "RECOMMENDATION_REQUEST" | "PAIN_COMPLAINT" | "HIRING_SIGNAL" | "PARTNERSHIP_INQUIRY" | "MARKET_TREND" | "OTHER",
  "confidenceScore": integer 0-100,
  "whyItMatters": "1-2 sentence explanation of why this is or isn't valuable",
  "suggestedOutreach": "1-2 sentence outreach suggestion if applicable, null if not an opportunity"
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
        whyItMatters: String(parsed.whyItMatters || ''),
        suggestedOutreach: parsed.suggestedOutreach || null,
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

    return {
      isOpportunity: score > 50,
      category: content.includes('recommend') ? SignalCategory.RECOMMENDATION_REQUEST
        : content.includes('hire') || content.includes('hiring') ? SignalCategory.HIRING_SIGNAL
        : content.includes('pain') || content.includes('problem') ? SignalCategory.PAIN_COMPLAINT
        : SignalCategory.BUYING_INTENT,
      confidenceScore: score,
      whyItMatters: `Contains ${matchCount} buying intent signals and matches ${kwMatches} monitored keywords.`,
      suggestedOutreach: score > 60 ? 'Engage with a relevant case study or expertise demonstration.' : null,
    };
  }

  normalize(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/https?:\/\/\S+/g, '[link]')
      .trim()
      .slice(0, 1000);
  }
}
