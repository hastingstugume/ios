'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { keywordsApi, organizationsApi, sourcesApi, type SourceTemplateSuggestion } from '@/lib/api';
import { SOURCE_PRESET_PACKS } from '@/lib/sourcePresets';
import { SOURCE_TYPE_META } from '@/lib/utils';
import { ArrowLeft, Bot, Sparkles } from 'lucide-react';

type InstallableTemplate = SourceTemplateSuggestion;

const PLAN_SOURCE_LIMITS: Record<string, number | null> = {
  free: 1,
  starter: 3,
  growth: 15,
  scale: null,
};

export default function SourceTemplatesPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

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

  const suggestionsLabel = suggestionsQuery.data?.source === 'generated'
    ? 'AI-generated for this workspace'
    : suggestionsQuery.data?.source === 'similar-cache'
      ? 'Reused from similar context'
      : suggestionsQuery.data?.source === 'cache'
        ? 'Saved for this workspace'
        : 'Suggested for this workspace';

  const normalizedPlan = (currentOrg?.plan || 'free').trim().toLowerCase();
  const maxSources = PLAN_SOURCE_LIMITS[normalizedPlan] ?? PLAN_SOURCE_LIMITS.free;
  const remainingSourceSlots = maxSources === null ? Number.POSITIVE_INFINITY : Math.max(maxSources - sources.length, 0);
  const existingSourceNames = new Set(sources.map((source) => source.name.trim().toLowerCase()));

  const getTemplateInstallBlocker = (preset: InstallableTemplate) => {
    const namespacedSourceNames = preset.sources.map((source) => `${preset.name} · ${source.name}`.trim().toLowerCase());
    const duplicateName = namespacedSourceNames.find((name) => existingSourceNames.has(name));
    if (duplicateName) {
      return 'This template is already installed in your sources.';
    }
    if (remainingSourceSlots < preset.sources.length) {
      const available = Number.isFinite(remainingSourceSlots) ? remainingSourceSlots : 0;
      return `This template needs ${preset.sources.length} source slots, but your ${currentOrg?.plan || 'Free'} plan has ${available} left.`;
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

      {!currentOrg?.businessFocus && !currentOrg?.targetAudience ? (
        <section className="section-card p-4">
          <p className="text-sm text-muted-foreground">
            Add a business focus and target buyers in Settings to make future template suggestions more specific to your niche.
          </p>
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
          <div className="grid gap-4 lg:grid-cols-2">
            {allTemplates.map((preset) => (
              <div key={preset.id} className="section-card p-5">
                {installPreset.variables?.id === preset.id && installPreset.isPending ? (
                  <div className="mb-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                    Installing template into your workspace...
                  </div>
                ) : null}
                {getTemplateInstallBlocker(preset) ? (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                    {getTemplateInstallBlocker(preset)}
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
                    disabled={installPreset.isPending || !!getTemplateInstallBlocker(preset)}
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
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
