'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { signalsApi, keywordsApi, sourcesApi } from '@/lib/api';
import { SignalCard } from '@/components/signals/SignalCard';
import { CATEGORY_META } from '@/lib/utils';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All categories' },
  ...Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label })),
];

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'SAVED', label: 'Saved' },
  { value: 'BOOKMARKED', label: 'Bookmarked' },
  { value: 'IGNORED', label: 'Ignored' },
];

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Any confidence' },
  { value: '85', label: '85%+ (Very High)' },
  { value: '70', label: '70%+ (High)' },
  { value: '50', label: '50%+ (Medium)' },
];

function Select({ value, onChange, options, className = '' }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-secondary border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 ${className}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function FeedPage() {
  const { currentOrgId } = useAuth();
  const [filters, setFilters] = useState({
    search: '', category: '', status: '', minConfidence: '',
    sourceId: '', keywordId: '', page: 1,
  });
  const [showFilters, setShowFilters] = useState(false);

  const setFilter = useCallback((key: string, value: string | number) => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }, []);

  const queryKey = ['signals', currentOrgId, filters];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => signalsApi.list(currentOrgId!, {
      ...filters,
      minConfidence: filters.minConfidence || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      sourceId: filters.sourceId || undefined,
      keywordId: filters.keywordId || undefined,
      search: filters.search || undefined,
    }),
    enabled: !!currentOrgId,
    keepPreviousData: true,
  });

  const { data: sources } = useQuery({
    queryKey: ['sources', currentOrgId],
    queryFn: () => sourcesApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: keywords } = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const activeFilterCount = [filters.category, filters.status, filters.minConfidence, filters.sourceId, filters.keywordId]
    .filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Opportunity Feed</h1>
            {data?.meta?.total !== undefined && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {data.meta.total.toLocaleString()} signals
              </span>
            )}
            {isFetching && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search signals…"
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
            <Select value={filters.category} onChange={(v) => setFilter('category', v)} options={CATEGORIES} />
            <Select value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUSES} />
            <Select value={filters.minConfidence} onChange={(v) => setFilter('minConfidence', v)} options={CONFIDENCE_OPTIONS} />
            <Select
              value={filters.sourceId}
              onChange={(v) => setFilter('sourceId', v)}
              options={[{ value: '', label: 'All sources' }, ...(sources || []).map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Select
              value={filters.keywordId}
              onChange={(v) => setFilter('keywordId', v)}
              options={[{ value: '', label: 'All keywords' }, ...(keywords || []).map((k) => ({ value: k.id, label: k.phrase }))]}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({ search: '', category: '', status: '', minConfidence: '', sourceId: '', keywordId: '', page: 1 })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-52 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Zap className="w-10 h-10 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium text-muted-foreground mb-1">No signals found</h3>
            <p className="text-sm text-muted-foreground/60 max-w-xs">
              Try adjusting your filters or add more keywords and sources to discover opportunities.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({ search: '', category: '', status: '', minConfidence: '', sourceId: '', keywordId: '', page: 1 })}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 max-w-3xl">
            {data.data.map((signal) => (
              <SignalCard key={signal.id} signal={signal} orgId={currentOrgId!} queryKey={queryKey} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6 pb-4">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', filters.page - 1)}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              Page <span className="text-foreground font-medium">{data.meta.page}</span> of{' '}
              <span className="text-foreground font-medium">{data.meta.totalPages}</span>
            </span>
            <button
              disabled={filters.page >= data.meta.totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
