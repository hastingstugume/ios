'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { keywordsApi } from '@/lib/api';
import { getPlanLimitUpgradeHint } from '@/lib/planLimitErrors';
import { WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

export default function KeywordsPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState('');
  const [desc, setDesc] = useState('');
  const [search, setSearch] = useState('');
  const {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError,
  } = useUpgradeCheckout(currentOrgId);

  const resetKeywordModal = () => {
    setAdding(false);
    setEditingId(null);
    setPhrase('');
    setDesc('');
    create.reset();
    update.reset();
  };

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const create = useMutation({
    mutationFn: () => keywordsApi.create(currentOrgId!, { phrase: phrase.trim(), description: desc.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] }); setPhrase(''); setDesc(''); setAdding(false); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      keywordsApi.update(currentOrgId!, id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => keywordsApi.delete(currentOrgId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] }),
  });

  const update = useMutation({
    mutationFn: (id: string) => keywordsApi.update(currentOrgId!, id, { phrase: phrase.trim(), description: desc.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keywords', currentOrgId] });
      setEditingId(null);
      setPhrase('');
      setDesc('');
    },
  });

  const filteredKeywords = keywords.filter((kw) => {
    const q = search.toLowerCase();
    return !q || kw.phrase.toLowerCase().includes(q) || kw.description?.toLowerCase().includes(q);
  });

  const activeKeywords = keywords.filter((kw) => kw.isActive).length;
  const trackedSignals = keywords.reduce((sum, kw) => sum + (kw._count?.signalKeywords ?? 0), 0);
  const keywordMutationError = create.error || update.error;
  const keywordUpgradeHint = getPlanLimitUpgradeHint(keywordMutationError, currentOrg?.plan);

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-hero space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Keywords</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor the internet for the phrases that matter to your business.</p>
          </div>
          <button
            onClick={() => {
              if (adding) {
                resetKeywordModal();
                return;
              }

              create.reset();
              update.reset();
              setEditingId(null);
              setAdding(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add keyword
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap">
          <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground">
            <span className="text-foreground font-semibold">{keywords.length}</span> tracked phrases
          </div>
          <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground">
            <span className="text-foreground font-semibold">{activeKeywords}</span> active
          </div>
          <div className="col-span-2 rounded-lg border border-border bg-secondary px-3 py-2 text-muted-foreground sm:col-span-1">
            <span className="text-foreground font-semibold">{trackedSignals}</span> matched signals
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords…"
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      <Modal
        open={adding || !!editingId}
        onClose={resetKeywordModal}
        title={editingId ? 'Edit keyword' : 'New keyword'}
        description="Create and refine the phrases that decide which conversations enter your opportunity feed."
      >
        <div className="space-y-3">
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. AI automation agency"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            onKeyDown={(e) => e.key === 'Enter' && phrase.trim() && (editingId ? update.mutate(editingId) : create.mutate())}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {keywordMutationError ? (
            keywordUpgradeHint ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
                <p>{keywordUpgradeHint.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordUpgradeHint.nextPlan ? (
                    <button
                      type="button"
                      onClick={() => startUpgradeCheckout(keywordUpgradeHint.nextPlan!, { sourceContext: 'keywords_limit_modal' })}
                      disabled={redirectingPlan === keywordUpgradeHint.nextPlan}
                      className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {redirectingPlan === keywordUpgradeHint.nextPlan
                        ? 'Redirecting…'
                        : `Upgrade to ${WORKSPACE_PLAN_MAP[keywordUpgradeHint.nextPlan].label}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => window.location.assign('/pricing')}
                      className="rounded-lg border border-primary/30 px-3 py-2 text-sm transition-colors hover:bg-primary/10"
                    >
                      See plans
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">{(keywordMutationError as Error).message}</p>
            )
          ) : null}
          {checkoutError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{checkoutError}</span>
                <button
                  type="button"
                  onClick={clearCheckoutError}
                  className="rounded-md border border-destructive/30 px-2 py-1 transition-colors hover:bg-destructive/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              disabled={!phrase.trim() || create.isPending || update.isPending}
              onClick={() => phrase.trim() && (editingId ? update.mutate(editingId) : create.mutate())}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {create.isPending || update.isPending ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save changes' : 'Add keyword')}
            </button>
            <button onClick={resetKeywordModal} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : !filteredKeywords.length ? (
        <div className="section-card p-10 text-center">
          <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No keywords match this search.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filteredKeywords.map((kw) => (
            <div key={kw.id} className="section-card px-4 py-4">
              <div className="flex items-start gap-3">
                <Tag className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${kw.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      {kw.phrase}
                    </span>
                    {kw._count?.signalKeywords ? (
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                        {kw._count.signalKeywords} signals
                      </span>
                    ) : null}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      kw.isActive
                        ? 'bg-green-400/10 text-green-400 border-green-400/20'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {kw.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {kw.description && <p className="text-xs text-muted-foreground mt-1 leading-6">{kw.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditingId(kw.id);
                      setAdding(false);
                      setPhrase(kw.phrase);
                      setDesc(kw.description || '');
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggle.mutate({ id: kw.id, isActive: !kw.isActive })}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                    title={kw.isActive ? 'Pause' : 'Activate'}
                  >
                    {kw.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => confirm('Delete this keyword?') && remove.mutate(kw.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
