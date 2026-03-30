// packages/types/src/index.ts
// Shared DTOs and types across apps

export type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';

export type SignalCategory =
  | 'BUYING_INTENT'
  | 'RECOMMENDATION_REQUEST'
  | 'PAIN_COMPLAINT'
  | 'HIRING_SIGNAL'
  | 'PARTNERSHIP_INQUIRY'
  | 'MARKET_TREND'
  | 'OTHER';

export type SignalStatus = 'NEW' | 'SAVED' | 'IGNORED' | 'BOOKMARKED';
export type SourceType = 'REDDIT' | 'REDDIT_SEARCH' | 'RSS' | 'HN_SEARCH' | 'GITHUB_SEARCH' | 'STACKOVERFLOW_SEARCH' | 'WEB_SEARCH' | 'MANUAL' | 'TWITTER';
export type SourceStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';
export type AlertFrequency = 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}
