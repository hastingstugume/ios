'use client';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { signalsApi, keywordsApi, sourcesApi, organizationsApi } from '@/lib/api';
import { SignalCard } from '@/components/signals/SignalCard';
import { CATEGORY_META, STAGE_META } from '@/lib/utils';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Target,
  X,
  Zap,
} from 'lucide-react';

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
    <div className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 sm:min-w-[140px]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5 text-primary" />
        {label}
      </div>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

function QuickFilterChip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export default function FeedPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    search: '', category: '', status: '', stage: '', minConfidence: '',
    sourceId: '', keywordId: '', assigneeId: '', page: 1,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [fetchFeedback, setFetchFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

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

  const fetchNow = useMutation({
    mutationFn: (sourceId: string) => sourcesApi.fetchNow(currentOrgId!, sourceId),
    onSuccess: () => {
      setFetchFeedback({ tone: 'success', message: 'Fetch queued. We will refresh once new signals land.' });
      qc.invalidateQueries({ queryKey: ['signals', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', currentOrgId] });
    },
    onError: (error: Error) => {
      setFetchFeedback({ tone: 'error', message: error.message });
    },
  });

  const activeFilterCount = [filters.category, filters.status, filters.stage, filters.minConfidence, filters.sourceId, filters.keywordId, filters.assigneeId]
    .filter(Boolean).length;

  const signalCount = data?.meta?.total ?? 0;
  const savedCount = data?.data?.filter((signal) => signal.status === 'SAVED').length ?? 0;
  const highConfidenceCount = data?.data?.filter((signal) => (signal.confidenceScore ?? 0) >= 85).length ?? 0;
  const inProgressCount = data?.data?.filter((signal) => ['IN_PROGRESS', 'OUTREACH', 'QUALIFIED'].includes(signal.stage)).length ?? 0;
  const trustedSourceCount = data?.data?.filter((signal) => signal.sourceProfile?.supportStatus === 'production_ready').length ?? 0;
  const allSources = sources || [];
  const activeSources = allSources.filter((source) => source.status === 'ACTIVE');
  const erroredSources = allSources.filter((source) => source.status === 'ERROR' || !!source.errorMessage);
  const likelyCredentialBlockedSources = activeSources.filter(
    (source) => !source.lastFetchedAt && !source.errorMessage && ['REDDIT', 'REDDIT_SEARCH', 'WEB_SEARCH'].includes(source.type),
  );
  const activeKeywords = (keywords || []).filter((keyword) => keyword.isActive);
  const primarySource = activeSources[0] ?? null;
  const hasNoActiveSources = activeSources.length === 0;
  const hasNoActiveKeywords = activeKeywords.length === 0;
  const noSignalsYet = signalCount === 0;

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-hero space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors sm:w-auto ${
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

        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap">
          <StatChip label="Signals" value={signalCount} icon={Clock} />
          <StatChip label="High Confidence" value={highConfidenceCount} icon={Target} />
          <StatChip label="Saved" value={savedCount} icon={Bookmark} />
          <StatChip label="Active Pipeline" value={inProgressCount} icon={Zap} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickFilterChip
            label="Urgent"
            icon={Siren}
            active={filters.search === 'urgent OR blocked OR migration'}
            onClick={() => setFilter('search', filters.search === 'urgent OR blocked OR migration' ? '' : 'urgent OR blocked OR migration')}
          />
          <QuickFilterChip
            label="Recommendations"
            icon={Target}
            active={filters.category === 'RECOMMENDATION_REQUEST'}
            onClick={() => setFilter('category', filters.category === 'RECOMMENDATION_REQUEST' ? '' : 'RECOMMENDATION_REQUEST')}
          />
          <QuickFilterChip
            label="Pain reports"
            icon={Zap}
            active={filters.category === 'PAIN_COMPLAINT'}
            onClick={() => setFilter('category', filters.category === 'PAIN_COMPLAINT' ? '' : 'PAIN_COMPLAINT')}
          />
          <QuickFilterChip
            label="85%+ confidence"
            icon={ShieldCheck}
            active={filters.minConfidence === '85'}
            onClick={() => setFilter('minConfidence', filters.minConfidence === '85' ? '' : '85')}
          />
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {trustedSourceCount} on this page come from production-ready sources
          </span>
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
          <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={filters.category} onChange={(v) => setFilter('category', v)} options={CATEGORIES} className="w-full" />
            <Select value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUSES} className="w-full" />
            <Select value={filters.stage} onChange={(v) => setFilter('stage', v)} options={STAGES} className="w-full" />
            <Select value={filters.minConfidence} onChange={(v) => setFilter('minConfidence', v)} options={CONFIDENCE_OPTIONS} className="w-full" />
            <Select
              value={filters.sourceId}
              onChange={(v) => setFilter('sourceId', v)}
              className="w-full"
              options={[{ value: '', label: 'All sources' }, ...(sources || []).map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Select
              value={filters.keywordId}
              onChange={(v) => setFilter('keywordId', v)}
              className="w-full"
              options={[{ value: '', label: 'All keywords' }, ...(keywords || []).map((k) => ({ value: k.id, label: k.phrase }))]}
            />
            <Select
              value={filters.assigneeId}
              onChange={(v) => setFilter('assigneeId', v)}
              className="w-full"
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
        <div className="section-card px-6 py-10">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="text-center">
              <Zap className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" />
              <h3 className="text-base font-medium text-foreground">No signals yet</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                Let&apos;s unblock your first high-intent opportunities. Use these quick checks:
              </p>
            </div>

            {fetchFeedback ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  fetchFeedback.tone === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {fetchFeedback.message}
              </div>
            ) : null}

            <div className="space-y-2.5">
              {activeFilterCount > 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <p className="text-sm text-foreground">Your current filters may be hiding matching signals.</p>
                  </div>
                  <button
                    onClick={() =>
                      setFilters({ search: '', category: '', status: '', stage: '', minConfidence: '', sourceId: '', keywordId: '', assigneeId: '', page: 1 })
                    }
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">
                  {hasNoActiveSources
                    ? 'Connect at least one active source to start collecting buyer-demand posts.'
                    : `${activeSources.length} active source${activeSources.length === 1 ? '' : 's'} connected.`}
                </p>
                <Link href="/sources" className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent">
                  {hasNoActiveSources ? 'Add source' : 'Manage sources'}
                </Link>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">
                  {hasNoActiveKeywords
                    ? 'Add a few intent-heavy keywords so matching posts can be classified.'
                    : `${activeKeywords.length} active keyword${activeKeywords.length === 1 ? '' : 's'} tracking demand.`}
                </p>
                <Link href="/keywords" className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent">
                  {hasNoActiveKeywords ? 'Add keywords' : 'Refine keywords'}
                </Link>
              </div>

              {noSignalsYet && primarySource ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground">
                    Run a fresh pull on <span className="font-medium">{primarySource.name}</span> to generate your first results faster.
                  </p>
                  <button
                    onClick={() => {
                      setFetchFeedback(null);
                      fetchNow.mutate(primarySource.id);
                    }}
                    disabled={fetchNow.isPending}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {fetchNow.isPending ? 'Queuing…' : 'Fetch now'}
                  </button>
                </div>
              ) : null}

              {erroredSources.length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {erroredSources.length} source{erroredSources.length === 1 ? '' : 's'} need attention. Open Sources and resolve connection errors.
                </div>
              ) : null}

              {likelyCredentialBlockedSources.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  Some sources have never fetched. If using Reddit or web-search connectors, verify provider credentials in your backend environment.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {data.data.map((signal) => (
            <SignalCard key={signal.id} signal={signal} orgId={currentOrgId!} queryKey={queryKey} />
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
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
