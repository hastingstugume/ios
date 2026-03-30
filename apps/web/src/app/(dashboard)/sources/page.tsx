'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { keywordsApi, organizationsApi, sourcesApi } from '@/lib/api';
import { SOURCE_TYPE_META, formatDate } from '@/lib/utils';
import { SOURCE_PRESET_PACKS, SOURCE_QUERY_TEMPLATES } from '@/lib/sourcePresets';
import { Database, Plus, Trash2, PauseCircle, PlayCircle, AlertCircle, CheckCircle2, Search, Sparkles, Wand2, Activity, TrendingUp, Target } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

const SOURCE_TYPES = [
  {
    value: 'REDDIT',
    label: 'Reddit Subreddit',
    fields: [{ key: 'subreddit', label: 'Subreddit name', placeholder: 'entrepreneur' }],
  },
  {
    value: 'REDDIT_SEARCH',
    label: 'Reddit Search',
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'looking for AI automation agency' },
      { key: 'subreddit', label: 'Optional subreddit', placeholder: 'smallbusiness' },
      { key: 'sort', label: 'Sort', placeholder: 'new', kind: 'select', options: ['new', 'relevance', 'top'] },
    ],
  },
  {
    value: 'RSS',
    label: 'RSS / Atom Feed',
    fields: [{ key: 'url', label: 'Feed URL', placeholder: 'https://hnrss.org/ask' }],
  },
  {
    value: 'HN_SEARCH',
    label: 'Hacker News Search',
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'need devops consultant' },
      { key: 'tags', label: 'Tags', placeholder: 'story', kind: 'select', options: ['story', 'comment', 'story,comment'] },
    ],
  },
  {
    value: 'GITHUB_SEARCH',
    label: 'GitHub Search',
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'looking for kubernetes consultant' },
      { key: 'repo', label: 'Optional repo/org', placeholder: 'vercel/next.js' },
      { key: 'contentType', label: 'Content type', placeholder: 'discussions', kind: 'select', options: ['discussions', 'issues'] },
    ],
  },
  {
    value: 'STACKOVERFLOW_SEARCH',
    label: 'Stack Overflow Search',
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'need help with devops pipeline' },
      { key: 'stackTags', label: 'Optional tags', placeholder: 'kubernetes, devops, docker' },
      { key: 'stackSort', label: 'Sort', placeholder: 'activity', kind: 'select', options: ['activity', 'votes', 'creation'] },
    ],
  },
  {
    value: 'WEB_SEARCH',
    label: 'Web Search',
    fields: [
      { key: 'query', label: 'Search query', placeholder: 'recommend kubernetes consultant' },
      { key: 'domains', label: 'Optional domains', placeholder: 'reddit.com, stackoverflow.com, news.ycombinator.com' },
    ],
  },
  { value: 'MANUAL', label: 'Manual Import', fields: [] },
];

const EMPTY_FORM = {
  name: '',
  type: 'REDDIT',
  subreddit: '',
  url: '',
  query: '',
  sort: 'new',
  tags: 'story',
  repo: '',
  contentType: 'discussions',
  stackTags: '',
  stackSort: 'activity',
  domains: '',
  excludeTerms: '',
  sourceWeight: '1.0',
};

export default function SourcesPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const [presetFeedbackTone, setPresetFeedbackTone] = useState<'success' | 'error'>('success');
  const [installingPresetId, setInstallingPresetId] = useState<string | null>(null);
  const [previewFeedback, setPreviewFeedback] = useState<string | null>(null);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }),
  });

  const installPreset = useMutation({
    onMutate: (presetId: string) => {
      setInstallingPresetId(presetId);
      setPresetFeedback(null);
    },
    mutationFn: async (presetId: string) => {
      const preset = SOURCE_PRESET_PACKS.find((item) => item.id === presetId);
      if (!preset || !currentOrgId) throw new Error('Preset unavailable');

      const existingKeywordSet = new Set(keywords.map((keyword) => keyword.phrase.trim().toLowerCase()));
      const mergedNegativeKeywords = [...(currentOrg?.negativeKeywords || [])];
      const existingNegativeSet = new Set(mergedNegativeKeywords.map((term) => term.trim().toLowerCase()));
      let created = 0;
      let skipped = 0;
      let keywordsAdded = 0;
      let negativesAdded = 0;
      let firstError: string | null = null;

      for (const source of preset.sources) {
        try {
          await sourcesApi.create(currentOrgId, source);
          created += 1;
        } catch (error) {
          skipped += 1;
          if (!firstError) firstError = (error as Error).message;
        }
      }

      for (const phrase of (preset.recommendedKeywords || []).map((item) => item.trim()).filter(Boolean)) {
        if (existingKeywordSet.has(phrase.toLowerCase())) continue;
        try {
          await keywordsApi.create(currentOrgId, { phrase });
          existingKeywordSet.add(phrase.toLowerCase());
          keywordsAdded += 1;
        } catch (error) {
          if (!firstError) firstError = (error as Error).message;
        }
      }

      for (const term of (preset.recommendedNegativeKeywords || []).map((item) => item.trim()).filter(Boolean)) {
        if (existingNegativeSet.has(term.toLowerCase())) continue;
        existingNegativeSet.add(term.toLowerCase());
        mergedNegativeKeywords.push(term);
        negativesAdded += 1;
      }

      if (negativesAdded > 0) {
        await organizationsApi.update(currentOrgId, { negativeKeywords: mergedNegativeKeywords });
      }

      return { preset, created, skipped, keywordsAdded, negativesAdded, firstError };
    },
    onSuccess: ({ preset, created, skipped, keywordsAdded, negativesAdded, firstError }) => {
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      setPresetFeedbackTone(created > 0 || keywordsAdded > 0 || negativesAdded > 0 ? 'success' : 'error');
      setPresetFeedback(
        created > 0 || keywordsAdded > 0 || negativesAdded > 0
          ? `${preset.name}: added ${created} source${created === 1 ? '' : 's'}${keywordsAdded ? `, ${keywordsAdded} keyword${keywordsAdded === 1 ? '' : 's'}` : ''}${negativesAdded ? `, ${negativesAdded} negative${negativesAdded === 1 ? '' : 's'}` : ''}${skipped ? `, skipped ${skipped}` : ''}${firstError ? ` (${firstError})` : ''}.`
          : `${preset.name}: no sources added${firstError ? ` (${firstError})` : ''}.`,
      );
    },
    onError: (error) => {
      setPresetFeedbackTone('error');
      setPresetFeedback((error as Error).message || 'Could not install preset.');
    },
    onSettled: () => {
      setInstallingPresetId(null);
    },
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

  const applyTemplate = (template: typeof SOURCE_QUERY_TEMPLATES[number]) => {
    setPreviewFeedback(null);
    setForm((current) => ({
      ...current,
      query: template.query ?? current.query,
      subreddit: template.subreddit ?? current.subreddit,
      sort: template.sort ?? current.sort,
      tags: template.tags ? template.tags.join(',') : current.tags,
      repo: template.repo ?? current.repo,
      contentType: template.contentType ?? current.contentType,
      stackTags: template.stackTags ? template.stackTags.join(', ') : current.stackTags,
      stackSort: template.stackSort ?? current.stackSort,
      domains: template.domains ? template.domains.join(', ') : current.domains,
    }));
  };

  const previewResults = previewSource.data?.previewItems || [];

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
          onClick={() => setAdding(!adding)}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add source
        </button>
      </section>

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
          <p className="text-sm text-muted-foreground">Keep source names clear so the feed stays easy to scan.</p>
        </div>
      </section>

      <section className="section-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Sparkles className="h-4 w-4 text-primary sm:mt-0.5" />
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Starter presets</h2>
              <p className="mt-1 text-sm text-muted-foreground">Install a curated source pack by niche to start discovering pain points and lead opportunities faster.</p>
            </div>
            {presetFeedback ? (
              <div className={`rounded-lg px-3 py-2 text-sm ${
                presetFeedbackTone === 'error'
                  ? 'border border-destructive/20 bg-destructive/10 text-destructive'
                  : 'border border-primary/20 bg-primary/10 text-primary'
              }`}>
                {presetFeedback}
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {SOURCE_PRESET_PACKS.map((preset) => (
                <div key={preset.id} className="rounded-xl border border-border bg-secondary p-4">
                  {installingPresetId === preset.id ? (
                    <div className="mb-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                      Installing preset into your live workspace...
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{preset.audience}</p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {preset.sources.length} sources
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{preset.description}</p>
                  {preset.recommendedKeywords?.length ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Recommended keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {preset.recommendedKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground/80">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addRecommendedKeywords.mutate(preset.recommendedKeywords || [])}
                        disabled={addRecommendedKeywords.isPending}
                        className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 sm:w-auto"
                      >
                        {addRecommendedKeywords.isPending ? 'Adding keywords…' : 'Add recommended keywords'}
                      </button>
                    </div>
                  ) : null}
                  {preset.recommendedNegativeKeywords?.length ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Recommended negatives</p>
                      <div className="flex flex-wrap gap-2">
                        {preset.recommendedNegativeKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => applyRecommendedNegatives.mutate(preset.recommendedNegativeKeywords || [])}
                        disabled={applyRecommendedNegatives.isPending}
                        className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 sm:w-auto"
                      >
                        {applyRecommendedNegatives.isPending ? 'Applying negatives…' : 'Apply recommended negatives'}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preset.sources.slice(0, 3).map((source) => (
                      <span key={source.name} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                        {SOURCE_TYPE_META[source.type]?.label || source.type}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => installPreset.mutate(preset.id)}
                    disabled={installingPresetId === preset.id}
                    className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
                  >
                    {installingPresetId === preset.id ? 'Installing…' : 'Install preset'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={adding || !!editingId}
        onClose={() => { setAdding(false); setEditingId(null); setForm(EMPTY_FORM); setPreviewFeedback(null); previewSource.reset(); }}
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
                {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
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
                        ) : item.excludedByWorkspace || item.excludedBySource ? (
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
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {item.author ? <span>By {item.author}</span> : null}
                        {item.publishedAt ? <span>{formatDate(item.publishedAt)}</span> : null}
                        {item.excludedByWorkspace ? <span>Blocked by workspace negatives</span> : null}
                        {item.excludedBySource ? <span>Blocked by source exclusions</span> : null}
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
          {(create.error || updateSource.error) && <p className="text-sm text-destructive">{((create.error || updateSource.error) as Error).message}</p>}
          <div className="flex gap-2">
            <button disabled={!form.name || create.isPending || updateSource.isPending} onClick={() => editingId ? updateSource.mutate() : create.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
              {create.isPending || updateSource.isPending ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save source' : 'Add source')}
            </button>
            <button onClick={() => { setAdding(false); setEditingId(null); setForm(EMPTY_FORM); setPreviewFeedback(null); previewSource.reset(); }} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredSources.map((src) => {
            const typeMeta = SOURCE_TYPE_META[src.type] || { label: src.type, icon: '🔗' };
            const configSummary = src.type === 'REDDIT'
              ? `r/${src.config?.subreddit || 'unknown'}`
              : src.type === 'REDDIT_SEARCH'
                ? `Query: ${src.config?.query || 'n/a'}${src.config?.subreddit ? ` in r/${src.config.subreddit}` : ''}`
              : src.type === 'RSS'
                ? src.config?.url || 'Feed URL not set'
                : src.type === 'HN_SEARCH'
                  ? `HN query: ${src.config?.query || 'n/a'}`
                  : src.type === 'GITHUB_SEARCH'
                    ? `GitHub ${src.config?.type || 'discussions'}: ${src.config?.query || 'n/a'}${src.config?.repo ? ` in ${src.config.repo}` : ''}`
                    : src.type === 'STACKOVERFLOW_SEARCH'
                      ? `Stack Overflow: ${src.config?.query || 'n/a'}${src.config?.tags?.length ? ` tagged ${src.config.tags.join(', ')}` : ''}`
                  : src.type === 'WEB_SEARCH'
                    ? `Web query: ${src.config?.query || 'n/a'}${src.config?.domains?.length ? ` on ${src.config.domains.join(', ')}` : ''}`
                : 'Manual source';

            return (
              <div key={src.id} className="section-card px-5 py-5">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-xl shrink-0">{typeMeta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-lg font-semibold ${src.status === 'PAUSED' ? 'text-muted-foreground' : 'text-foreground'}`}>{src.name}</span>
                      <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{typeMeta.label}</span>
                      {src._count?.signals ? (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{src._count.signals} signals</span>
                      ) : null}
                    </div>
                    <p className="mt-2 break-all text-sm text-muted-foreground">{configSummary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {src.status === 'ERROR' ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />{src.errorMessage?.slice(0, 80)}</span>
                      ) : src.status === 'ACTIVE' ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" />Active · Last fetch {formatDate(src.lastFetchedAt)}</span>
                      ) : (
                        <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Paused</span>
                      )}
                    </div>
                    {src.health ? (
                      <div className="mt-4 rounded-xl border border-border bg-background px-3 py-3">
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
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(src.id);
                        setAdding(false);
                        setForm({
                          name: src.name,
                          type: src.type,
                          subreddit: src.type === 'REDDIT' ? src.config?.subreddit || '' : '',
                          url: src.type === 'RSS' ? src.config?.url || '' : '',
                          query: src.type === 'REDDIT_SEARCH' || src.type === 'HN_SEARCH' || src.type === 'WEB_SEARCH' || src.type === 'GITHUB_SEARCH' || src.type === 'STACKOVERFLOW_SEARCH' ? src.config?.query || '' : '',
                          sort: src.type === 'REDDIT_SEARCH' ? src.config?.sort || 'new' : 'new',
                          tags: src.type === 'HN_SEARCH' ? src.config?.tags || 'story' : 'story',
                          repo: src.type === 'GITHUB_SEARCH' ? src.config?.repo || '' : '',
                          contentType: src.type === 'GITHUB_SEARCH' ? src.config?.type || 'discussions' : 'discussions',
                          stackTags: src.type === 'STACKOVERFLOW_SEARCH' ? (src.config?.tags || []).join(', ') : '',
                          stackSort: src.type === 'STACKOVERFLOW_SEARCH' ? src.config?.sort || 'activity' : 'activity',
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
                      onClick={() => confirm('Delete this source and all its signals?') && remove.mutate(src.id)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
  if (config.stackSort) {
    config.sort = config.stackSort;
    delete config.stackSort;
  }

  return config;
}
