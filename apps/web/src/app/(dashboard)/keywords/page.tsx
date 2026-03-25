'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { keywordsApi } from '@/lib/api';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, X, Search } from 'lucide-react';

export default function KeywordsPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [desc, setDesc] = useState('');
  const [search, setSearch] = useState('');

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

  const filteredKeywords = keywords.filter((kw) => {
    const q = search.toLowerCase();
    return !q || kw.phrase.toLowerCase().includes(q) || kw.description?.toLowerCase().includes(q);
  });

  const activeKeywords = keywords.filter((kw) => kw.isActive).length;
  const trackedSignals = keywords.reduce((sum, kw) => sum + (kw._count?.signalKeywords ?? 0), 0);

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-hero space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Keywords</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor the internet for the phrases that matter to your business.</p>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add keyword
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <div className="bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground">
            <span className="text-foreground font-semibold">{keywords.length}</span> tracked phrases
          </div>
          <div className="bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground">
            <span className="text-foreground font-semibold">{activeKeywords}</span> active
          </div>
          <div className="bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground">
            <span className="text-foreground font-semibold">{trackedSignals}</span> matched signals
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords…"
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {adding && (
        <div className="section-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">New keyword</h3>
            <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. AI automation agency"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            onKeyDown={(e) => e.key === 'Enter' && phrase.trim() && create.mutate()}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <button
              disabled={!phrase.trim() || create.isPending}
              onClick={() => phrase.trim() && create.mutate()}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {create.isPending ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

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
