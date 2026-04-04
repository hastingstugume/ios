'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { useRouter, useSearchParams } from 'next/navigation';
import { getNextPlan, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { getPlanLimitUpgradeHint } from '@/lib/planLimitErrors';
import { keywordsApi, organizationsApi, sourcesApi } from '@/lib/api';
import { SOURCE_TYPE_META, formatDate } from '@/lib/utils';
import { SOURCE_QUERY_TEMPLATES } from '@/lib/sourcePresets';
import { Database, Plus, Trash2, PauseCircle, PlayCircle, AlertCircle, CheckCircle2, Search, Wand2, Activity, TrendingUp, Target, ArrowRight, BrainCircuit, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

const SOURCE_TYPES = [
  {
    value: 'REDDIT',
    label: 'Reddit Subreddit',
    recommended: false,
    fields: [{ key: 'subreddit', label: 'Subreddit name', placeholder: 'entrepreneur' }],
  },
  {
    value: 'REDDIT_SEARCH',
    label: 'Reddit Search',
    recommended: false,
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'looking for AI automation agency' },
      { key: 'subreddit', label: 'Optional subreddit', placeholder: 'smallbusiness' },
      { key: 'sort', label: 'Sort', placeholder: 'new', kind: 'select', options: ['new', 'relevance', 'top'] },
    ],
  },
  {
    value: 'RSS',
    label: 'RSS / Atom Feed',
    recommended: true,
    fields: [{ key: 'url', label: 'Feed URL', placeholder: 'https://hnrss.org/ask' }],
  },
  {
    value: 'DISCOURSE',
    label: 'Discourse Community',
    recommended: true,
    fields: [
      { key: 'baseUrl', label: 'Community URL', placeholder: 'https://meta.discourse.org' },
      { key: 'query', label: 'Optional query', placeholder: 'recommend consultant OR migration help' },
      { key: 'discourseTags', label: 'Optional tags', placeholder: 'consulting, migration, agency' },
      { key: 'discoursePostedWithinDays', label: 'Posted within', placeholder: '30', kind: 'select', options: ['7', '14', '30', '60', '90'] },
    ],
  },
  {
    value: 'HN_SEARCH',
    label: 'Hacker News Search',
    recommended: false,
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'need devops consultant' },
      { key: 'tags', label: 'Tags', placeholder: 'story', kind: 'select', options: ['story', 'comment', 'story,comment'] },
    ],
  },
  {
    value: 'GITHUB_SEARCH',
    label: 'GitHub Search',
    recommended: true,
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'looking for kubernetes consultant' },
      { key: 'repo', label: 'Optional repo/org', placeholder: 'vercel/next.js' },
      { key: 'contentType', label: 'Content type', placeholder: 'discussions', kind: 'select', options: ['discussions', 'issues'] },
    ],
  },
  {
    value: 'STACKOVERFLOW_SEARCH',
    label: 'Stack Overflow Search',
    recommended: true,
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'need help with devops pipeline' },
      { key: 'stackTags', label: 'Optional tags', placeholder: 'kubernetes, devops, docker' },
      { key: 'stackSort', label: 'Sort', placeholder: 'activity', kind: 'select', options: ['activity', 'votes', 'creation'] },
    ],
  },
  {
    value: 'SAM_GOV',
    label: 'SAM.gov Opportunities',
    recommended: true,
    fields: [
      { key: 'query', label: 'Keyword query', placeholder: 'cybersecurity support, CRM implementation, data migration' },
      { key: 'agency', label: 'Optional agency', placeholder: 'Department of Veterans Affairs' },
      { key: 'naicsCode', label: 'Optional NAICS code', placeholder: '541512' },
      { key: 'noticeTypes', label: 'Notice types', placeholder: 'presolicitation, solicitation', kind: 'select', options: ['solicitation', 'presolicitation', 'sources_sought', 'combined_synopsis_solicitation'] },
      { key: 'postedWithinDays', label: 'Posted within', placeholder: '30', kind: 'select', options: ['7', '14', '30', '60', '90'] },
    ],
  },
  {
    value: 'WEB_SEARCH',
    label: 'Web Search',
    recommended: false,
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'recommend kubernetes consultant' },
      { key: 'domains', label: 'Optional domains', placeholder: 'reddit.com, stackoverflow.com, news.ycombinator.com' },
    ],
  },
  { value: 'MANUAL', label: 'Manual Import', recommended: true, fields: [] },
];

const EMPTY_FORM = {
  name: '',
  type: 'REDDIT',
  subreddit: '',
  url: '',
  baseUrl: '',
  query: '',
  sort: 'new',
  tags: 'story',
  repo: '',
  contentType: 'discussions',
  stackTags: '',
  stackSort: 'activity',
  discourseTags: '',
  discoursePostedWithinDays: '30',
  naicsCode: '',
  agency: '',
  noticeTypes: 'solicitation',
  postedWithinDays: '30',
  domains: '',
  excludeTerms: '',
  sourceWeight: '1.0',
};

const SOURCE_TYPE_SUPPORT: Record<string, {
  providerLabel: string;
  badgeLabel: string;
  supportStatus: 'production_ready' | 'limited' | 'legacy' | 'planned';
  complianceNotes: string;
}> = {
  REDDIT: {
    providerLabel: 'Reddit Data API',
    badgeLabel: 'Official API',
    supportStatus: 'production_ready',
    complianceNotes: 'Use only where Reddit access is approved for your use case.',
  },
  REDDIT_SEARCH: {
    providerLabel: 'Reddit Data API',
    badgeLabel: 'Official API',
    supportStatus: 'production_ready',
    complianceNotes: 'Search-based Reddit coverage, subject to Reddit approval requirements.',
  },
  RSS: {
    providerLabel: 'Publisher Feed',
    badgeLabel: 'RSS Feed',
    supportStatus: 'production_ready',
    complianceNotes: 'Publisher-provided feeds are the cleanest low-friction source type.',
  },
  DISCOURSE: {
    providerLabel: 'Discourse JSON Endpoint',
    badgeLabel: 'Public JSON',
    supportStatus: 'limited',
    complianceNotes: 'Good for public operator and SaaS communities that expose public Discourse JSON endpoints without auth.',
  },
  HN_SEARCH: {
    providerLabel: 'Public Search',
    badgeLabel: 'Public Search',
    supportStatus: 'limited',
    complianceNotes: 'Useful for founder/operator demand, but lower assurance than official APIs and feeds.',
  },
  GITHUB_SEARCH: {
    providerLabel: 'GitHub Search API',
    badgeLabel: 'Official API',
    supportStatus: 'production_ready',
    complianceNotes: 'Strong choice for implementation pain, blockers, and community support requests.',
  },
  STACKOVERFLOW_SEARCH: {
    providerLabel: 'Stack Exchange API',
    badgeLabel: 'Official API',
    supportStatus: 'production_ready',
    complianceNotes: 'Good for urgent technical pain and recurring implementation issues.',
  },
  SAM_GOV: {
    providerLabel: 'SAM.gov Opportunities API',
    badgeLabel: 'Public API',
    supportStatus: 'production_ready',
    complianceNotes: 'Strong for active public-sector demand, procurement notices, and contract opportunities with real deadlines.',
  },
  WEB_SEARCH: {
    providerLabel: 'Configured Search Provider',
    badgeLabel: 'Search Provider',
    supportStatus: 'limited',
    complianceNotes: 'Only use in production with an approved configured provider; otherwise treat as limited.',
  },
  MANUAL: {
    providerLabel: 'Manual Import',
    badgeLabel: 'Manual',
    supportStatus: 'production_ready',
    complianceNotes: 'Best when you already know the exact source and want full control.',
  },
};

export default function SourcesPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const [presetFeedbackTone, setPresetFeedbackTone] = useState<'success' | 'error'>('success');
  const [previewFeedback, setPreviewFeedback] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);

  const installedTemplate = searchParams.get('installed');
  const installedCreated = searchParams.get('created');
  const installedSkipped = searchParams.get('skipped');
  const installedNote = searchParams.get('note');

  useEffect(() => {
    if (!installedTemplate) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('installed');
    next.delete('created');
    next.delete('skipped');
    next.delete('note');
    const query = next.toString();
    router.replace(query ? `/sources?${query}` : '/sources');
  }, [installedTemplate, installedCreated, installedSkipped, installedNote, router, searchParams]);

  const normalizedPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const canFetchNow = normalizedPlan !== 'free';
  const nextPlan = getNextPlan(normalizedPlan);
  const {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError,
  } = useUpgradeCheckout(currentOrgId);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources', currentOrgId],
    queryFn: () => sourcesApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const create = useMutation({
    mutationFn: () => sourcesApi.create(currentOrgId!, { name: form.name, type: form.type, config: buildSourceConfig(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }); setAdding(false); setForm(EMPTY_FORM); },
  });

  const updateSource = useMutation({
    mutationFn: () => sourcesApi.update(currentOrgId!, editingId!, { name: form.name, config: buildSourceConfig(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      setEditingId(null);
      setAdding(false);
      setForm(EMPTY_FORM);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => sourcesApi.update(currentOrgId!, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => sourcesApi.delete(currentOrgId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      setDeleteCandidate(null);
    },
  });

  const fetchNow = useMutation({
    mutationFn: (id: string) => sourcesApi.fetchNow(currentOrgId!, id),
    onMutate: (id: string) => {
      setFetchingSourceId(id);
      setPresetFeedbackTone('success');
      setPresetFeedback('Fetch queued. New matches should appear shortly.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['signals', currentOrgId] });
    },
    onError: (error: Error) => {
      setPresetFeedbackTone('error');
      setPresetFeedback(error.message);
    },
    onSettled: () => setFetchingSourceId(null),
  });

  const addRecommendedKeywords = useMutation({
    mutationFn: async (phrases: string[]) => {
      if (!currentOrgId) throw new Error('Workspace unavailable');

      const existing = new Set(keywords.map((keyword) => keyword.phrase.trim().toLowerCase()));
      const uniquePhrases = phrases.map((phrase) => phrase.trim()).filter(Boolean);
      let created = 0;
      let skipped = 0;
      let firstError: string | null = null;

      for (const phrase of uniquePhrases) {
        if (existing.has(phrase.toLowerCase())) {
          skipped += 1;
          continue;
        }

        try {
          await keywordsApi.create(currentOrgId, { phrase });
          existing.add(phrase.toLowerCase());
          created += 1;
        } catch (error) {
          skipped += 1;
          if (!firstError) firstError = (error as Error).message;
        }
      }

      return { created, skipped, firstError };
    },
    onSuccess: ({ created, skipped, firstError }) => {
      qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] });
      setPresetFeedbackTone(firstError && created === 0 ? 'error' : 'success');
      setPresetFeedback(
        created > 0
          ? `Added ${created} recommended keyword${created === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}${firstError ? ` (${firstError})` : ''}.`
          : `No new keywords added${skipped ? `, skipped ${skipped}` : ''}${firstError ? ` (${firstError})` : ''}.`,
      );
    },
    onError: (error) => {
      setPresetFeedbackTone('error');
      setPresetFeedback((error as Error).message || 'Could not add suggested keywords.');
    },
  });

  const applyRecommendedNegatives = useMutation({
    mutationFn: async (negativeTerms: string[]) => {
      if (!currentOrgId) throw new Error('Workspace unavailable');

      const existing = new Set((currentOrg?.negativeKeywords || []).map((term) => term.trim().toLowerCase()));
      const merged = [...(currentOrg?.negativeKeywords || [])];

      for (const term of negativeTerms.map((item) => item.trim()).filter(Boolean)) {
        if (existing.has(term.toLowerCase())) continue;
        existing.add(term.toLowerCase());
        merged.push(term);
      }

      await organizationsApi.update(currentOrgId, { negativeKeywords: merged });
      return { total: merged.length };
    },
    onSuccess: ({ total }) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      setPresetFeedbackTone('success');
      setPresetFeedback(`Applied recommended negatives. Workspace now has ${total} negative keyword${total === 1 ? '' : 's'}.`);
    },
    onError: (error) => {
      setPresetFeedbackTone('error');
      setPresetFeedback((error as Error).message || 'Could not apply suggested negatives.');
    },
  });

  const previewSource = useMutation({
    mutationFn: () => {
      if (!currentOrgId) throw new Error('Workspace unavailable');
      return sourcesApi.preview(currentOrgId, { type: form.type, config: buildSourceConfig(form) });
    },
    onSuccess: (result) => {
      setPreviewFeedback(
        result.matchingCount > 0
          ? `Preview found ${result.matchingCount} likely match${result.matchingCount === 1 ? '' : 'es'} from ${result.totalFetched} fetched result${result.totalFetched === 1 ? '' : 's'}.`
          : `Preview fetched ${result.totalFetched} result${result.totalFetched === 1 ? '' : 's'}, but none currently pass your keyword and negative filters.`,
      );
    },
  });

  const selectedType = SOURCE_TYPES.find((t) => t.value === form.type)!;
  const queryTemplates = SOURCE_QUERY_TEMPLATES.filter((template) => template.type === form.type);
  const filteredSources = sources.filter((src) => {
    const q = search.toLowerCase();
    const configText = JSON.stringify(src.config || {}).toLowerCase();
    return !q || src.name.toLowerCase().includes(q) || src.type.toLowerCase().includes(q) || configText.includes(q);
  });
  const activeSources = sources.filter((src) => src.status === 'ACTIVE').length;
  const totalSignals = sources.reduce((sum, src) => sum + (src._count?.signals ?? 0), 0);
  const errorSources = sources.filter((src) => src.status === 'ERROR').length;
  const hasSources = sources.length > 0;
  const showEmptySourceState = !isLoading && !hasSources && !search;

  const getSupportBadgeClass = (status?: string) => {
    if (status === 'production_ready') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if (status === 'limited') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    if (status === 'legacy') return 'border-destructive/20 bg-destructive/10 text-destructive';
    if (status === 'planned') return 'border-border bg-secondary text-muted-foreground';
    return 'border-border bg-secondary text-muted-foreground';
  };

  const applyTemplate = (template: typeof SOURCE_QUERY_TEMPLATES[number]) => {
    setPreviewFeedback(null);
    setForm((current) => ({
      ...current,
      baseUrl: template.baseUrl ?? current.baseUrl,
      query: template.query ?? current.query,
      subreddit: template.subreddit ?? current.subreddit,
      sort: template.sort ?? current.sort,
      tags: template.tags ? template.tags.join(',') : current.tags,
      discourseTags: template.tags ? template.tags.join(', ') : current.discourseTags,
      discoursePostedWithinDays: template.postedWithinDays ? String(template.postedWithinDays) : current.discoursePostedWithinDays,
      repo: template.repo ?? current.repo,
      contentType: template.contentType ?? current.contentType,
      stackTags: template.stackTags ? template.stackTags.join(', ') : current.stackTags,
      stackSort: template.stackSort ?? current.stackSort,
      naicsCode: current.naicsCode,
      agency: current.agency,
      noticeTypes: current.noticeTypes,
      postedWithinDays: current.postedWithinDays,
      domains: template.domains ? template.domains.join(', ') : current.domains,
    }));
  };

  const previewResults = previewSource.data?.previewItems || [];
  const selectedTypeSupport = SOURCE_TYPE_SUPPORT[form.type] || SOURCE_TYPE_SUPPORT.MANUAL;
  const sourceMutationError = create.error || updateSource.error;
  const sourceUpgradeHint = getPlanLimitUpgradeHint(sourceMutationError, currentOrg?.plan);
  const orderedSourceTypes = [
    ...SOURCE_TYPES.filter((type) => type.recommended && SOURCE_TYPE_SUPPORT[type.value]?.supportStatus === 'production_ready'),
    ...SOURCE_TYPES.filter((type) => type.recommended && SOURCE_TYPE_SUPPORT[type.value]?.supportStatus !== 'production_ready'),
    ...SOURCE_TYPES.filter((type) => !type.recommended),
  ];
  const recommendedSourceTypes = orderedSourceTypes.filter((type) => type.recommended);
  const secondarySourceTypes = orderedSourceTypes.filter((type) => !type.recommended);

  const resetSourceModal = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreviewFeedback(null);
    setPresetFeedback(null);
    create.reset();
    updateSource.reset();
    previewSource.reset();
    addRecommendedKeywords.reset();
    applyRecommendedNegatives.reset();
  };

  const closeDeleteModal = () => {
    setDeleteCandidate(null);
    remove.reset();
  };

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sources</h1>
            <p className="mt-2 text-base text-muted-foreground">Configure where to discover signals.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground">
              <span className="font-medium text-foreground">{activeSources}</span> active
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground">
              <span className="font-medium text-foreground">{totalSignals}</span> total signals
            </div>
            <div className="col-span-2 rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground sm:col-span-1">
              <span className="font-medium text-foreground">{errorSources}</span> need attention
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (adding) {
              resetSourceModal();
              return;
            }

            resetSourceModal();
            setAdding(true);
          }}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add source
        </button>
      </section>

      {installedTemplate ? (
        <section className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Installed <span className="font-medium">{installedTemplate}</span>
          {installedCreated ? ` with ${installedCreated} source${installedCreated === '1' ? '' : 's'}` : ''}
          {installedSkipped ? `, skipped ${installedSkipped}` : ''}
          {installedNote ? ` (${installedNote})` : ''}.
        </section>
      ) : null}

      {!canFetchNow ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Free workspaces run on schedule only. Upgrade to {nextPlan ? WORKSPACE_PLAN_MAP[nextPlan].label : 'a paid plan'} for on-demand fetches and faster iteration.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-100"
              >
                See plans
              </Link>
              {nextPlan ? (
                <button
                  type="button"
                  onClick={() => startUpgradeCheckout(nextPlan, { sourceContext: 'sources_fetch_limit_banner' })}
                  disabled={!!redirectingPlan}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {redirectingPlan === nextPlan ? 'Redirecting…' : `Upgrade to ${WORKSPACE_PLAN_MAP[nextPlan].label}`}
                </button>
              ) : null}
            </div>
          </div>
          {checkoutError ? (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{checkoutError}</span>
                <button
                  type="button"
                  onClick={clearCheckoutError}
                  className="rounded-md border border-destructive/40 px-2 py-0.5 transition-colors hover:bg-destructive/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showEmptySourceState ? (
        <section className="section-card p-6 md:p-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <BrainCircuit className="h-3.5 w-3.5" />
              Source setup
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Start with a template or create your first source.</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Templates are the fastest way to get coverage. Manual setup is better when you already know the exact feed, subreddit, or search query you want to monitor.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push('/sources/templates')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Use a template
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  resetSourceModal();
                  setAdding(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Create a source manually
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="section-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by source name or config..."
                className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">Keep source names clear so the feed stays easy to scan.</p>
              <button
                type="button"
                onClick={() => router.push('/sources/templates')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Use template
              </button>
            </div>
          </div>
        </section>
      )}

      <Modal
        open={adding || !!editingId}
        onClose={resetSourceModal}
        title={editingId ? 'Edit source' : 'New source'}
        description="Add direct sources and search-driven discovery feeds so the scanner can find pain points, buying intent, and lead opportunities across more of the web."
      >
        <div className="space-y-4">
          {presetFeedback ? (
            <div className={`rounded-lg px-3 py-2 text-sm ${
              presetFeedbackTone === 'error'
                ? 'border border-destructive/20 bg-destructive/10 text-destructive'
                : 'border border-primary/20 bg-primary/10 text-primary'
            }`}>
              {presetFeedback}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Source type</label>
              {!editingId ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {recommendedSourceTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        previewSource.reset();
                        setPreviewFeedback(null);
                        setForm((f) => ({ ...f, type: type.value }));
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        form.type === type.value
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <select
                value={form.type}
                onChange={(e) => {
                  previewSource.reset();
                  setPreviewFeedback(null);
                  setForm((f) => ({ ...f, type: e.target.value }));
                }}
                disabled={!!editingId}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <optgroup label="Recommended">
                  {recommendedSourceTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} · {SOURCE_TYPE_SUPPORT[t.value]?.supportStatus.replaceAll('_', ' ')}
                    </option>
                  ))}
                </optgroup>
                {secondarySourceTypes.length ? (
                  <optgroup label="Other sources">
                    {secondarySourceTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} · {SOURCE_TYPE_SUPPORT[t.value]?.supportStatus.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {!editingId ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Start with RSS, GitHub, Stack Overflow, Discourse, or Manual unless you specifically need a limited or approval-dependent source.
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Display name</label>
              <input
                value={form.name}
                onChange={(e) => {
                  previewSource.reset();
                  setPreviewFeedback(null);
                  setForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder="e.g. r/entrepreneur"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {selectedTypeSupport.providerLabel}
              </span>
              <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {selectedTypeSupport.badgeLabel}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getSupportBadgeClass(selectedTypeSupport.supportStatus)}`}>
                {selectedTypeSupport.supportStatus.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {selectedTypeSupport.complianceNotes}
            </p>
          </div>
          {selectedType.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs text-muted-foreground">{field.label}</label>
              {field.kind === 'select' ? (
                <select
                  value={form[field.key as keyof typeof form] as string}
                  onChange={(e) => {
                    previewSource.reset();
                    setPreviewFeedback(null);
                    setForm((f) => ({ ...f, [field.key]: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  value={form[field.key as keyof typeof form] as string}
                  onChange={(e) => {
                    previewSource.reset();
                    setPreviewFeedback(null);
                    setForm((f) => ({ ...f, [field.key]: e.target.value }));
                  }}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          ))}
          {queryTemplates.length > 0 ? (
            <div>
              <label className="mb-2 block text-xs text-muted-foreground">Quick query templates</label>
              <div className="flex flex-wrap gap-2">
                {queryTemplates.map((template) => (
                  <button
                    key={`${template.type}-${template.label}`}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={template.description}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Use a template, then tune the query to fit your niche and offer.</p>
              {queryTemplates.map((template) => (
                <div key={`${template.type}-${template.label}-meta`} className="mt-3 rounded-lg border border-border bg-background px-3 py-3">
                  <p className="text-xs font-medium text-foreground">{template.label}</p>
                  {template.description ? <p className="mt-1 text-xs text-muted-foreground">{template.description}</p> : null}
                  {template.recommendedKeywords?.length ? (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Suggested tracked keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {template.recommendedKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground/80">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addRecommendedKeywords.mutate(template.recommendedKeywords || [])}
                        disabled={addRecommendedKeywords.isPending}
                        className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {addRecommendedKeywords.isPending ? 'Adding keywords…' : 'Add suggested keywords'}
                      </button>
                    </div>
                  ) : null}
                  {template.recommendedNegativeKeywords?.length ? (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Suggested negatives</p>
                      <div className="flex flex-wrap gap-2">
                        {template.recommendedNegativeKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => applyRecommendedNegatives.mutate(template.recommendedNegativeKeywords || [])}
                        disabled={applyRecommendedNegatives.isPending}
                        className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {applyRecommendedNegatives.isPending ? 'Applying negatives…' : 'Apply suggested negatives'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Exclude terms</label>
              <input
                value={form.excludeTerms}
                onChange={(e) => {
                  previewSource.reset();
                  setPreviewFeedback(null);
                  setForm((f) => ({ ...f, excludeTerms: e.target.value }));
                }}
                placeholder="job board, affiliate, newsletter"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Optional comma-separated filters to suppress noisy matches.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Source weight</label>
              <input
                value={form.sourceWeight}
                onChange={(e) => {
                  previewSource.reset();
                  setPreviewFeedback(null);
                  setForm((f) => ({ ...f, sourceWeight: e.target.value }));
                }}
                placeholder="1.0"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Boost or reduce ranking impact from 0.5 to 1.5.</p>
            </div>
          </div>
          {form.type !== 'MANUAL' ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Preview matches</p>
                  <p className="mt-1 text-xs text-muted-foreground">Fetch a small live sample and see which results would survive keyword and negative filters before saving.</p>
                </div>
                <button
                  type="button"
                  onClick={() => previewSource.mutate()}
                  disabled={previewSource.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" />
                  {previewSource.isPending ? 'Testing…' : 'Test query'}
                </button>
              </div>
              {previewFeedback ? (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {previewFeedback}
                </div>
              ) : null}
              {previewSource.error ? (
                <p className="mt-3 text-sm text-destructive">{(previewSource.error as Error).message}</p>
              ) : null}
              {previewResults.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {previewResults.map((item) => (
                    <div key={item.externalId} className="rounded-lg border border-border bg-secondary px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.passesFilters ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300">
                            Likely match{item.confidenceScore !== null ? ` · ${item.confidenceScore}` : ''}
                          </span>
                        ) : item.excludedByWorkspace || item.excludedBySource || item.excludedByLowSignal ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                            Filtered out
                          </span>
                        ) : (
                          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                            No keyword hit
                          </span>
                        )}
                        {item.category ? (
                          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                            {item.category.replaceAll('_', ' ')}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{item.text}</p>
                      {item.matchedKeywords.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.matchedKeywords.map((keyword) => (
                            <span key={`${item.externalId}-${keyword}`} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground/80">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.whyItMatters ? (
                        <p className="mt-2 text-xs text-muted-foreground">{item.whyItMatters}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.urgency ? <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{item.urgency.toLowerCase()} urgency</span> : null}
                        {item.sentiment ? <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{item.sentiment.toLowerCase()} tone</span> : null}
                        {item.sourceProfile ? <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{item.sourceProfile.badgeLabel}</span> : null}
                        {item.sourceProfile ? (
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${getSupportBadgeClass(item.sourceProfile.supportStatus)}`}>
                            {item.sourceProfile.supportStatus.replaceAll('_', ' ')}
                          </span>
                        ) : null}
                      </div>
                      {item.sourceProfile?.complianceNotes ? (
                        <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                          {item.sourceProfile.complianceNotes}
                        </p>
                      ) : null}
                      {item.suggestedReply ? (
                        <div className="mt-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">Suggested reply</p>
                          <p className="mt-1 text-xs text-foreground/80">{item.suggestedReply}</p>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {item.author ? <span>By {item.author}</span> : null}
                        {item.publishedAt ? <span>{formatDate(item.publishedAt)}</span> : null}
                        {item.excludedByWorkspace ? <span>Blocked by workspace negatives</span> : null}
                        {item.excludedBySource ? <span>Blocked by source exclusions</span> : null}
                        {item.excludedByLowSignal ? <span>Filtered as low-signal chatter</span> : null}
                        <a href={item.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Open result
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {sourceMutationError ? (
            sourceUpgradeHint ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
                <p>{sourceUpgradeHint.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceUpgradeHint.nextPlan ? (
                    <button
                      type="button"
                      onClick={() => startUpgradeCheckout(sourceUpgradeHint.nextPlan!, { sourceContext: 'sources_limit_modal' })}
                      disabled={redirectingPlan === sourceUpgradeHint.nextPlan}
                      className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {redirectingPlan === sourceUpgradeHint.nextPlan
                        ? 'Redirecting…'
                        : `Upgrade to ${WORKSPACE_PLAN_MAP[sourceUpgradeHint.nextPlan].label}`}
                    </button>
                  ) : (
                    <Link
                      href="/pricing"
                      className="rounded-lg border border-primary/30 px-3 py-2 text-sm transition-colors hover:bg-primary/10"
                    >
                      See plans
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      updateSource.reset();
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">{(sourceMutationError as Error).message}</p>
            )
          ) : null}
          <div className="flex gap-2">
            <button disabled={!form.name || create.isPending || updateSource.isPending} onClick={() => editingId ? updateSource.mutate() : create.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
              {create.isPending || updateSource.isPending ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save source' : 'Add source')}
            </button>
            <button onClick={resetSourceModal} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteCandidate}
        onClose={() => {
          if (remove.isPending) return;
          closeDeleteModal();
        }}
        title="Delete source?"
        description={
          deleteCandidate
            ? `${deleteCandidate.name} and its collected signals will be removed from this workspace.`
            : 'This source and its collected signals will be removed from this workspace.'
        }
        size="compact"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            This action can’t be undone.
          </div>
          {remove.error ? <p className="text-sm text-destructive">{(remove.error as Error).message}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={remove.isPending}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteCandidate && remove.mutate(deleteCandidate.id)}
              disabled={remove.isPending}
              className="rounded-xl bg-destructive px-4 py-2.5 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {remove.isPending ? 'Deleting…' : 'Delete source'}
            </button>
          </div>
        </div>
      </Modal>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />)}</div>
      ) : !filteredSources.length ? (
        <div className="section-card p-10 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No sources match this search.</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(360px,1fr))]">
          {filteredSources.map((src) => {
            const typeMeta = SOURCE_TYPE_META[src.type] || { label: src.type, icon: '🔗' };
            const configSummary = src.type === 'REDDIT'
              ? `r/${src.config?.subreddit || 'unknown'}`
              : src.type === 'REDDIT_SEARCH'
                ? `Query: ${src.config?.query || 'n/a'}${src.config?.subreddit ? ` in r/${src.config.subreddit}` : ''}`
              : src.type === 'RSS'
                ? src.config?.url || 'Feed URL not set'
                : src.type === 'DISCOURSE'
                  ? `Discourse: ${src.config?.baseUrl || 'n/a'}${src.config?.query ? ` · ${src.config.query}` : ''}${src.config?.tags?.length ? ` · tags ${src.config.tags.join(', ')}` : ''}`
                : src.type === 'HN_SEARCH'
                  ? `HN query: ${src.config?.query || 'n/a'}`
                  : src.type === 'GITHUB_SEARCH'
                    ? `GitHub ${src.config?.type || 'discussions'}: ${src.config?.query || 'n/a'}${src.config?.repo ? ` in ${src.config.repo}` : ''}`
                  : src.type === 'STACKOVERFLOW_SEARCH'
                      ? `Stack Overflow: ${src.config?.query || 'n/a'}${src.config?.tags?.length ? ` tagged ${src.config.tags.join(', ')}` : ''}`
                  : src.type === 'SAM_GOV'
                      ? `SAM.gov: ${src.config?.query || 'n/a'}${src.config?.agency ? ` · ${src.config.agency}` : ''}${src.config?.naicsCode ? ` · NAICS ${src.config.naicsCode}` : ''}`
                  : src.type === 'WEB_SEARCH'
                    ? `Web query: ${src.config?.query || 'n/a'}${src.config?.domains?.length ? ` on ${src.config.domains.join(', ')}` : ''}`
                : 'Manual source';

            return (
              <div key={src.id} className="section-card px-5 py-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-xl">{typeMeta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-lg font-semibold ${src.status === 'PAUSED' ? 'text-muted-foreground' : 'text-foreground'}`}>{src.name}</span>
                            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{typeMeta.label}</span>
                            {src.sourceProfile ? (
                              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {src.sourceProfile.badgeLabel}
                              </span>
                            ) : null}
                            {src._count?.signals ? (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{src._count.signals} signals</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start">
                          {canFetchNow ? (
                            <button
                              onClick={() => fetchNow.mutate(src.id)}
                              disabled={fetchNow.isPending || src.status === 'PAUSED'}
                              className="rounded-lg border border-border px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                              title={src.status === 'PAUSED' ? 'Resume this source before fetching' : 'Fetch now'}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <RefreshCw className={`h-4 w-4 ${fetchingSourceId === src.id ? 'animate-spin' : ''}`} />
                                {fetchingSourceId === src.id ? 'Queuing…' : 'Fetch now'}
                              </span>
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              create.reset();
                              updateSource.reset();
                              setPresetFeedback(null);
                              setPreviewFeedback(null);
                              setEditingId(src.id);
                              setAdding(false);
                              setForm({
                                name: src.name,
                                type: src.type,
                                subreddit: src.type === 'REDDIT' ? src.config?.subreddit || '' : '',
                                url: src.type === 'RSS' ? src.config?.url || '' : '',
                                baseUrl: src.type === 'DISCOURSE' ? src.config?.baseUrl || '' : '',
                                query: src.type === 'REDDIT_SEARCH' || src.type === 'DISCOURSE' || src.type === 'HN_SEARCH' || src.type === 'WEB_SEARCH' || src.type === 'GITHUB_SEARCH' || src.type === 'STACKOVERFLOW_SEARCH' ? src.config?.query || '' : '',
                                sort: src.type === 'REDDIT_SEARCH' ? src.config?.sort || 'new' : 'new',
                                tags: src.type === 'HN_SEARCH' ? src.config?.tags || 'story' : 'story',
                                repo: src.type === 'GITHUB_SEARCH' ? src.config?.repo || '' : '',
                                contentType: src.type === 'GITHUB_SEARCH' ? src.config?.type || 'discussions' : 'discussions',
                                stackTags: src.type === 'STACKOVERFLOW_SEARCH' ? (src.config?.tags || []).join(', ') : '',
                                stackSort: src.type === 'STACKOVERFLOW_SEARCH' ? src.config?.sort || 'activity' : 'activity',
                                discourseTags: src.type === 'DISCOURSE' ? (src.config?.tags || []).join(', ') : '',
                                discoursePostedWithinDays: src.type === 'DISCOURSE' ? String(src.config?.postedWithinDays || '30') : '30',
                                naicsCode: src.type === 'SAM_GOV' ? src.config?.naicsCode || '' : '',
                                agency: src.type === 'SAM_GOV' ? src.config?.agency || '' : '',
                                noticeTypes: src.type === 'SAM_GOV' ? (src.config?.noticeTypes?.[0] || 'solicitation') : 'solicitation',
                                postedWithinDays: src.type === 'SAM_GOV' ? String(src.config?.postedWithinDays || '30') : '30',
                                domains: src.type === 'WEB_SEARCH' ? (src.config?.domains || []).join(', ') : '',
                                excludeTerms: (src.config?.excludeTerms || []).join(', '),
                                sourceWeight: String(src.config?.sourceWeight ?? 1.0),
                              });
                            }}
                            className="rounded-lg border border-border px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStatus.mutate({ id: src.id, status: src.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title={src.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                          >
                            {src.status === 'ACTIVE' ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5 text-green-400" />}
                          </button>
                          <button
                            onClick={() => {
                              remove.reset();
                              setDeleteCandidate({ id: src.id, name: src.name });
                            }}
                            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm leading-7 text-muted-foreground">{configSummary}</p>
                      {src.sourceProfile ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                            {src.sourceProfile.providerLabel}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getSupportBadgeClass(src.sourceProfile.supportStatus)}`}>
                            {src.sourceProfile.supportStatus.replaceAll('_', ' ')}
                          </span>
                        </div>
                      ) : null}
                      {src.sourceProfile?.complianceNotes ? (
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">
                          {src.sourceProfile.complianceNotes}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {src.status === 'ERROR' ? (
                          <span className="flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />{src.errorMessage?.slice(0, 80)}</span>
                        ) : src.status === 'ACTIVE' ? (
                          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" />Active · Last fetch {formatDate(src.lastFetchedAt)}</span>
                        ) : (
                          <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Paused</span>
                        )}
                      </div>
                    </div>
                    {src.health ? (
                      <div className="rounded-xl border border-border bg-background px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            src.health.label === 'Strong'
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              : src.health.label === 'Promising'
                                ? 'border-primary/20 bg-primary/10 text-primary'
                                : src.health.label === 'Needs attention'
                                  ? 'border-destructive/20 bg-destructive/10 text-destructive'
                                  : 'border-border bg-secondary text-muted-foreground'
                          }`}>
                            Health: {src.health.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">Score {src.health.score}</span>
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <Activity className="h-3.5 w-3.5" />
                              Last 7 Days
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">{src.health.last7dSignals} signals</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <Target className="h-3.5 w-3.5" />
                              High Confidence
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">{src.health.highConfidenceSignals} strong leads</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Pipeline Impact
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">{src.health.pipelineSignals} active or won</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saved by Team</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{src.health.savedSignals} saved</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildSourceConfig(form: typeof EMPTY_FORM) {
  const typeInfo = SOURCE_TYPES.find((type) => type.value === form.type)!;
  const config: Record<string, any> = {};

  typeInfo.fields.forEach((field) => {
    const rawValue = form[field.key as keyof typeof form] as string;
    if (!rawValue) return;
    config[field.key] = field.key === 'domains'
      ? rawValue.split(',').map((domain) => domain.trim()).filter(Boolean)
      : field.key === 'stackTags'
        ? rawValue.split(',').map((tag) => tag.trim()).filter(Boolean)
        : field.key === 'discourseTags'
          ? rawValue.split(',').map((tag) => tag.trim()).filter(Boolean)
        : field.key === 'noticeTypes'
          ? [rawValue]
        : rawValue;
  });

  if (form.excludeTerms.trim()) {
    config.excludeTerms = form.excludeTerms.split(',').map((term) => term.trim()).filter(Boolean);
  }
  if (form.sourceWeight.trim()) {
    config.sourceWeight = Number(form.sourceWeight);
  }
  if (config.contentType) {
    config.type = config.contentType;
    delete config.contentType;
  }
  if (config.stackTags) {
    config.tags = config.stackTags;
    delete config.stackTags;
  }
  if (config.discourseTags) {
    config.tags = config.discourseTags;
    delete config.discourseTags;
  }
  if (config.stackSort) {
    config.sort = config.stackSort;
    delete config.stackSort;
  }
  if (config.discoursePostedWithinDays) {
    config.postedWithinDays = Number(config.discoursePostedWithinDays);
    delete config.discoursePostedWithinDays;
  }
  if (config.postedWithinDays) {
    config.postedWithinDays = Number(config.postedWithinDays);
  }

  return config;
}
