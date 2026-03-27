'use client';
import { useState, useCallback } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { signalsApi, keywordsApi, sourcesApi, organizationsApi } from '@/lib/api';
import { SignalCard } from '@/components/signals/SignalCard';
import { CATEGORY_META, STAGE_META } from '@/lib/utils';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, Zap, Bookmark, Target, Clock } from 'lucide-react';

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

const STAGES = [
  { value: '', label: 'All stages' },
  ...Object.entries(STAGE_META).map(([value, meta]) => ({ value, label: meta.label })),
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
      className={`bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 ${className}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function StatChip({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-secondary border border-border rounded-lg px-3 py-2 min-w-[140px]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5 text-primary" />
        {label}
      </div>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

export default function FeedPage() {
  const { currentOrgId } = useAuth();
  const [filters, setFilters] = useState({
    search: '', category: '', status: '', stage: '', minConfidence: '',
    sourceId: '', keywordId: '', assigneeId: '', page: 1,
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
      stage: filters.stage || undefined,
      sourceId: filters.sourceId || undefined,
      keywordId: filters.keywordId || undefined,
      assigneeId: filters.assigneeId || undefined,
      search: filters.search || undefined,
    }),
    enabled: !!currentOrgId,
    placeholderData: keepPreviousData,
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

  const { data: memberData } = useQuery({
    queryKey: ['org-members', currentOrgId],
    queryFn: () => organizationsApi.members(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const activeFilterCount = [filters.category, filters.status, filters.stage, filters.minConfidence, filters.sourceId, filters.keywordId, filters.assigneeId]
    .filter(Boolean).length;

  const signalCount = data?.meta?.total ?? 0;
  const savedCount = data?.data?.filter((signal) => signal.status === 'SAVED').length ?? 0;
  const highConfidenceCount = data?.data?.filter((signal) => (signal.confidenceScore ?? 0) >= 85).length ?? 0;
  const inProgressCount = data?.data?.filter((signal) => ['IN_PROGRESS', 'OUTREACH', 'QUALIFIED'].includes(signal.stage)).length ?? 0;

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-hero space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Opportunity Feed</h1>
              {isFetching && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Review the strongest internet demand signals and move promising leads into action.</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatChip label="Signals" value={signalCount} icon={Clock} />
          <StatChip label="High Confidence" value={highConfidenceCount} icon={Target} />
          <StatChip label="Saved" value={savedCount} icon={Bookmark} />
          <StatChip label="Active Pipeline" value={inProgressCount} icon={Zap} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search signals…"
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Select value={filters.category} onChange={(v) => setFilter('category', v)} options={CATEGORIES} />
            <Select value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUSES} />
            <Select value={filters.stage} onChange={(v) => setFilter('stage', v)} options={STAGES} />
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
            <Select
              value={filters.assigneeId}
              onChange={(v) => setFilter('assigneeId', v)}
              options={[{ value: '', label: 'Any owner' }, ...((memberData?.members || []).map((member) => ({ value: member.userId, label: member.user.name || member.user.email })))]}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({ search: '', category: '', status: '', stage: '', minConfidence: '', sourceId: '', keywordId: '', assigneeId: '', page: 1 })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-56 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="section-card px-6 py-16 text-center">
          <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">No signals found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Try adjusting your filters or add more keywords and sources to discover opportunities.
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({ search: '', category: '', status: '', stage: '', minConfidence: '', sourceId: '', keywordId: '', assigneeId: '', page: 1 })}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {data.data.map((signal) => (
            <SignalCard key={signal.id} signal={signal} orgId={currentOrgId!} queryKey={queryKey} />
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilter('page', filters.page - 1)}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
