import { SourceType } from '@prisma/client';

export type SourceAcquisitionMode =
  | 'official_api'
  | 'rss'
  | 'provider_api'
  | 'partner_required'
  | 'manual_only'
  | 'legacy';

export type SourceSupportStatus =
  | 'production_ready'
  | 'limited'
  | 'legacy'
  | 'planned';

export interface SourceProfile {
  platformLabel: string;
  providerLabel: string;
  acquisitionMode: SourceAcquisitionMode;
  supportStatus: SourceSupportStatus;
  badgeLabel: string;
  complianceNotes: string;
}

const PROFILES: Record<SourceType, SourceProfile> = {
  REDDIT: {
    platformLabel: 'Reddit',
    providerLabel: 'Reddit Data API',
    acquisitionMode: 'official_api',
    supportStatus: 'production_ready',
    badgeLabel: 'Official API',
    complianceNotes: 'Uses Reddit OAuth and Data API access.',
  },
  REDDIT_SEARCH: {
    platformLabel: 'Reddit',
    providerLabel: 'Reddit Data API',
    acquisitionMode: 'official_api',
    supportStatus: 'production_ready',
    badgeLabel: 'Official API',
    complianceNotes: 'Uses Reddit OAuth search endpoints.',
  },
  RSS: {
    platformLabel: 'RSS',
    providerLabel: 'Publisher Feed',
    acquisitionMode: 'rss',
    supportStatus: 'production_ready',
    badgeLabel: 'RSS Feed',
    complianceNotes: 'Uses publisher-provided RSS or Atom feeds.',
  },
  DISCOURSE: {
    platformLabel: 'Discourse',
    providerLabel: 'Discourse JSON Endpoint',
    acquisitionMode: 'provider_api',
    supportStatus: 'limited',
    badgeLabel: 'Public JSON',
    complianceNotes: 'Uses public Discourse JSON endpoints where communities expose them without authentication.',
  },
  HN_SEARCH: {
    platformLabel: 'Hacker News',
    providerLabel: 'HN Search',
    acquisitionMode: 'provider_api',
    supportStatus: 'limited',
    badgeLabel: 'Public Search',
    complianceNotes: 'Uses a public search provider and should be treated as limited-support.',
  },
  GITHUB_SEARCH: {
    platformLabel: 'GitHub',
    providerLabel: 'GitHub Search API',
    acquisitionMode: 'official_api',
    supportStatus: 'production_ready',
    badgeLabel: 'Official API',
    complianceNotes: 'Uses GitHub search APIs with rate limits and optional authentication.',
  },
  STACKOVERFLOW_SEARCH: {
    platformLabel: 'Stack Overflow',
    providerLabel: 'Stack Exchange API',
    acquisitionMode: 'official_api',
    supportStatus: 'production_ready',
    badgeLabel: 'Official API',
    complianceNotes: 'Uses the Stack Exchange public API with attribution requirements.',
  },
  SAM_GOV: {
    platformLabel: 'SAM.gov',
    providerLabel: 'SAM.gov Opportunities API',
    acquisitionMode: 'official_api',
    supportStatus: 'production_ready',
    badgeLabel: 'Public API',
    complianceNotes: 'Uses the public procurement opportunities API for contract and bid discovery.',
  },
  WEB_SEARCH: {
    platformLabel: 'Web Search',
    providerLabel: 'Configured Search Provider',
    acquisitionMode: 'provider_api',
    supportStatus: 'limited',
    badgeLabel: 'Search Provider',
    complianceNotes: 'Requires an approved search provider in production. Legacy adapters should only be used for local testing.',
  },
  MANUAL: {
    platformLabel: 'Manual',
    providerLabel: 'Manual Import',
    acquisitionMode: 'manual_only',
    supportStatus: 'production_ready',
    badgeLabel: 'Manual',
    complianceNotes: 'No automated collection; data is user-supplied.',
  },
  TWITTER: {
    platformLabel: 'X',
    providerLabel: 'Partner Integration Required',
    acquisitionMode: 'partner_required',
    supportStatus: 'planned',
    badgeLabel: 'Partner Required',
    complianceNotes: 'Only enable when an approved commercial integration path exists.',
  },
};

export function getSourceProfile(sourceType: SourceType): SourceProfile {
  return PROFILES[sourceType];
}
