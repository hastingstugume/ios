'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { getNextPlan, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { keywordsApi, organizationsApi, sourcesApi, type SourceTemplateSuggestion } from '@/lib/api';
import { SOURCE_PRESET_PACKS } from '@/lib/sourcePresets';
import { SOURCE_TYPE_META } from '@/lib/utils';
import { ArrowLeft, Bot, Sparkles } from 'lucide-react';

type InstallableTemplate = SourceTemplateSuggestion;

export default function SourceTemplatesPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<'all' | 'single' | 'double' | 'multi' | 'github' | 'hn' | 'stackoverflow' | 'rss'>('all');

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources', currentOrgId],
    queryFn: () => sourcesApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['source-suggestions', currentOrgId, currentOrg?.businessFocus, currentOrg?.targetAudience],
    queryFn: () => sourcesApi.suggestions(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const savedTemplatesQuery = useQuery({
    queryKey: ['saved-source-templates', currentOrgId],
    queryFn: () => sourcesApi.templates(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const suggestedTemplates: InstallableTemplate[] = suggestionsQuery.data?.suggestions?.length
    ? suggestionsQuery.data.suggestions
    : [];

  const curatedTemplates: InstallableTemplate[] = SOURCE_PRESET_PACKS.map((preset, index) => ({
    ...preset,
    recommendedKeywords: preset.recommendedKeywords || [],
    recommendedNegativeKeywords: preset.recommendedNegativeKeywords || [],
    rank: index,
    generatedBy: 'curated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const savedTemplates: InstallableTemplate[] = savedTemplatesQuery.data?.templates || [];

  const allTemplates: Array<InstallableTemplate & { templateKind: 'saved' | 'suggested' | 'starter' }> = [
    ...savedTemplates.map((preset) => ({ ...preset, templateKind: 'saved' as const })),
    ...suggestedTemplates.map((preset) => ({ ...preset, templateKind: 'suggested' as const })),
    ...curatedTemplates.map((preset) => ({ ...preset, templateKind: 'starter' as const })),
  ];

  const visibleTemplates = useMemo(() => {
    return allTemplates.filter((preset) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'single') return preset.sources.length === 1;
      if (activeFilter === 'double') return preset.sources.length === 2;
      if (activeFilter === 'multi') return preset.sources.length >= 3;
      if (activeFilter === 'github') return preset.sources.some((source) => source.type === 'GITHUB_SEARCH');
      if (activeFilter === 'hn') return preset.sources.some((source) => source.type === 'HN_SEARCH');
      if (activeFilter === 'stackoverflow') return preset.sources.some((source) => source.type === 'STACKOVERFLOW_SEARCH');
      if (activeFilter === 'rss') return preset.sources.some((source) => source.type === 'RSS');
      return true;
    });
  }, [activeFilter, allTemplates]);

  const suggestionsLabel = suggestionsQuery.data?.source === 'generated'
    ? 'AI-generated for this workspace'
    : suggestionsQuery.data?.source === 'similar-cache'
      ? 'Reused from similar context'
      : suggestionsQuery.data?.source === 'cache'
        ? 'Saved for this workspace'
        : 'Suggested for this workspace';

  const normalizedPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const currentPlanMeta = WORKSPACE_PLAN_MAP[normalizedPlan];
  const maxSources = currentPlanMeta.maxSources;
  const remainingSourceSlots = maxSources === null ? Number.POSITIVE_INFINITY : Math.max(maxSources - sources.length, 0);
  const nextPlan = getNextPlan(normalizedPlan);
  const {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError,
  } = useUpgradeCheckout(currentOrgId);
  const existingSourceNames = new Set(sources.map((source) => source.name.trim().toLowerCase()));
  const trackedKeywordCount = keywords.length;
  const negativeKeywordCount = currentOrg?.negativeKeywords?.length || 0;
  const hasSuggestionContext = Boolean(currentOrg?.businessFocus || currentOrg?.targetAudience || trackedKeywordCount || negativeKeywordCount);

  const getTemplateInstallBlocker = (preset: InstallableTemplate) => {
    const namespacedSourceNames = preset.sources.map((source) => `${preset.name} · ${source.name}`.trim().toLowerCase());
    const duplicateName = namespacedSourceNames.find((name) => existingSourceNames.has(name));
    if (duplicateName) {
      return 'This template is already installed in your sources.';
    }
    if (remainingSourceSlots < preset.sources.length) {
      const available = Number.isFinite(remainingSourceSlots) ? remainingSourceSlots : 0;
      return `This template needs ${preset.sources.length} sources, but your ${currentPlanMeta.label} plan has only ${available} slot${available === 1 ? '' : 's'} left.`;
    }
    return null;
  };

  const installPreset = useMutation<
    { preset: InstallableTemplate; created: number; skipped: number; keywordsAdded: number; negativesAdded: number; firstError: string | null },
    Error,
    InstallableTemplate
  >({
    mutationFn: async (preset) => {
      if (!currentOrgId) throw new Error('Template unavailable');
      const installBlocker = getTemplateInstallBlocker(preset);
      if (installBlocker) throw new Error(installBlocker);

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
          await sourcesApi.create(currentOrgId, {
            ...source,
            name: `${preset.name} · ${source.name}`,
          });
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

      if (created === 0 && firstError) {
        throw new Error(firstError);
      }

      return { preset, created, skipped, keywordsAdded, negativesAdded, firstError };
    },
    onSuccess: async ({ preset, created, skipped, firstError }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }),
        qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] }),
        qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
      ]);
      const params = new URLSearchParams();
      params.set('installed', preset.name);
      params.set('created', String(created));
      if (skipped) params.set('skipped', String(skipped));
      if (firstError) params.set('note', firstError);
      router.push(`/sources?${params.toString()}`);
    },
  });

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4">
        <Link href="/sources" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to sources
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Templates
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Choose a source template</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Start with a ready-made source pack built for your niche, then come back to Sources to refine, pause, or add exact sources manually.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            {suggestionsLabel}
          </div>
        </div>
      </section>

      <section className="section-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Suggestion context</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These templates are ranked using your workspace niche, buyer profile, tracked keywords, and negative filters.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            Refine workspace profile
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {currentOrg?.businessFocus ? (
            <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground">
              Focus: {currentOrg.businessFocus}
            </span>
          ) : null}
          {currentOrg?.targetAudience ? (
            <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground">
              Buyers: {currentOrg.targetAudience}
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
            {trackedKeywordCount} tracked keyword{trackedKeywordCount === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
            {negativeKeywordCount} negative keyword{negativeKeywordCount === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {!hasSuggestionContext ? (
        <section className="section-card p-4">
          <p className="text-sm text-muted-foreground">
            Add a business focus and target buyers in Settings to make future template suggestions more specific to your niche.
          </p>
        </section>
      ) : null}

      {maxSources !== null ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {currentPlanMeta.label} includes up to {maxSources} sources. You are using {sources.length}, with {remainingSourceSlots} slot{remainingSourceSlots === 1 ? '' : 's'} left.
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
                  onClick={() => startUpgradeCheckout(nextPlan, { sourceContext: 'source_templates_limit_banner' })}
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

      {installPreset.error ? (
        <section className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(installPreset.error as Error).message || 'Could not install template.'}
        </section>
      ) : null}

      {suggestionsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Templates</h2>
              <p className="mt-1 text-sm text-muted-foreground">Suggested, saved, and starter templates in one place.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['single', '1 source'],
              ['double', '2 sources'],
              ['multi', '3+ sources'],
              ['github', 'GitHub'],
              ['hn', 'HN'],
              ['stackoverflow', 'Stack Overflow'],
              ['rss', 'RSS'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveFilter(value as typeof activeFilter)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  activeFilter === value
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleTemplates.map((preset) => {
              const installBlocker = getTemplateInstallBlocker(preset);
              const isSourceLimitBlocker = installBlocker?.includes('source slots');

              return (
                <div key={preset.id} className="section-card p-5">
                  {installPreset.variables?.id === preset.id && installPreset.isPending ? (
                    <div className="mb-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                      Installing template into your workspace...
                    </div>
                  ) : null}
                  {installBlocker ? (
                    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                      <p>{installBlocker}</p>
                      {isSourceLimitBlocker ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-100"
                          >
                            See plans
                          </Link>
                          {nextPlan ? (
                            <button
                              type="button"
                              onClick={() => startUpgradeCheckout(nextPlan, { sourceContext: 'source_templates_card_limit' })}
                              disabled={!!redirectingPlan}
                              className="inline-flex items-center justify-center rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                              {redirectingPlan === nextPlan ? 'Redirecting…' : `Upgrade to ${WORKSPACE_PLAN_MAP[nextPlan].label}`}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{preset.name}</p>
                        {preset.templateKind === 'saved' ? (
                          <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Saved
                          </span>
                        ) : preset.templateKind === 'starter' ? (
                          <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Starter
                          </span>
                        ) : (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary">
                            Suggested
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{preset.audience}</p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {preset.sources.length} sources
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{preset.description}</p>

                  {preset.recommendedKeywords?.length ? (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Recommended keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {preset.recommendedKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground/80">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {preset.recommendedNegativeKeywords?.length ? (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Recommended negatives</p>
                      <div className="flex flex-wrap gap-2">
                        {preset.recommendedNegativeKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {preset.sources.map((source) => (
                      <span key={source.name} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                        {SOURCE_TYPE_META[source.type]?.label || source.type}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => installPreset.mutate(preset)}
                      disabled={installPreset.isPending || !!installBlocker}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {installPreset.variables?.id === preset.id && installPreset.isPending ? 'Installing…' : 'Install template'}
                    </button>
                    <Link
                      href="/sources"
                      className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Back to sources
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {!visibleTemplates.length ? (
            <div className="section-card p-8 text-center text-sm text-muted-foreground">
              No templates match this filter.
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
