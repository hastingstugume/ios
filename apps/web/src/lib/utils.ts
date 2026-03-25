import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  BUYING_INTENT:          { label: 'Buying Intent',    color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20' },
  RECOMMENDATION_REQUEST: { label: 'Recommendation',   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
  PAIN_COMPLAINT:         { label: 'Pain / Problem',   color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20' },
  HIRING_SIGNAL:          { label: 'Hiring Signal',    color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
  PARTNERSHIP_INQUIRY:    { label: 'Partnership',      color: 'text-cyan-400',   bg: 'bg-cyan-400/10 border-cyan-400/20' },
  MARKET_TREND:           { label: 'Market Trend',     color: 'text-slate-400',  bg: 'bg-slate-400/10 border-slate-400/20' },
  OTHER:                  { label: 'Other',            color: 'text-slate-400',  bg: 'bg-slate-400/10 border-slate-400/20' },
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW:        { label: 'New',        color: 'text-blue-400' },
  SAVED:      { label: 'Saved',      color: 'text-green-400' },
  BOOKMARKED: { label: 'Bookmarked', color: 'text-amber-400' },
  IGNORED:    { label: 'Ignored',    color: 'text-slate-500' },
};

export const SOURCE_TYPE_META: Record<string, { label: string; icon: string }> = {
  REDDIT:  { label: 'Reddit',  icon: '🤖' },
  RSS:     { label: 'RSS',     icon: '📡' },
  MANUAL:  { label: 'Manual',  icon: '📝' },
  TWITTER: { label: 'X/Twitter', icon: '𝕏' },
};

export function getConfidenceColor(score: number | null) {
  if (!score) return 'text-slate-500';
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-slate-400';
}

export function getConfidenceBg(score: number | null) {
  if (!score) return 'bg-slate-500/10 border-slate-500/20';
  if (score >= 85) return 'bg-green-400/10 border-green-400/20';
  if (score >= 70) return 'bg-blue-400/10 border-blue-400/20';
  if (score >= 50) return 'bg-amber-400/10 border-amber-400/20';
  return 'bg-slate-400/10 border-slate-400/20';
}
