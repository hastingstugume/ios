'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { sourcesApi } from '@/lib/api';
import { SOURCE_TYPE_META, formatDate } from '@/lib/utils';
import { Database, Plus, Trash2, PauseCircle, PlayCircle, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

const SOURCE_TYPES = [
  { value: 'REDDIT', label: 'Reddit Subreddit', fields: [{ key: 'subreddit', label: 'Subreddit name', placeholder: 'entrepreneur' }] },
  { value: 'RSS', label: 'RSS / Atom Feed', fields: [{ key: 'url', label: 'Feed URL', placeholder: 'https://hnrss.org/ask' }] },
  { value: 'MANUAL', label: 'Manual Import', fields: [] },
];

export default function SourcesPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'REDDIT', subreddit: '', url: '' });
  const [search, setSearch] = useState('');

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources', currentOrgId],
    queryFn: () => sourcesApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const create = useMutation({
    mutationFn: () => {
      const typeInfo = SOURCE_TYPES.find((t) => t.value === form.type)!;
      const config: Record<string, string> = {};
      typeInfo.fields.forEach((f) => { if (form[f.key as keyof typeof form]) config[f.key] = form[f.key as keyof typeof form] as string; });
      return sourcesApi.create(currentOrgId!, { name: form.name, type: form.type, config });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }); setAdding(false); setForm({ name: '', type: 'REDDIT', subreddit: '', url: '' }); },
  });

  const updateSource = useMutation({
    mutationFn: () => {
      const typeInfo = SOURCE_TYPES.find((t) => t.value === form.type)!;
      const config: Record<string, string> = {};
      typeInfo.fields.forEach((f) => { if (form[f.key as keyof typeof form]) config[f.key] = form[f.key as keyof typeof form] as string; });
      return sourcesApi.update(currentOrgId!, editingId!, { name: form.name, config });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources', currentOrgId] });
      setEditingId(null);
      setAdding(false);
      setForm({ name: '', type: 'REDDIT', subreddit: '', url: '' });
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

  const selectedType = SOURCE_TYPES.find((t) => t.value === form.type)!;
  const filteredSources = sources.filter((src) => {
    const q = search.toLowerCase();
    const configText = JSON.stringify(src.config || {}).toLowerCase();
    return !q || src.name.toLowerCase().includes(q) || src.type.toLowerCase().includes(q) || configText.includes(q);
  });
  const activeSources = sources.filter((src) => src.status === 'ACTIVE').length;
  const totalSignals = sources.reduce((sum, src) => sum + (src._count?.signals ?? 0), 0);
  const errorSources = sources.filter((src) => src.status === 'ERROR').length;

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sources</h1>
            <p className="mt-2 text-base text-muted-foreground">Configure where to discover signals.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{activeSources}</span> active
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{totalSignals}</span> total signals
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{errorSources}</span> need attention
            </div>
          </div>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add source
        </button>
      </section>

      <section className="section-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
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

      <Modal
        open={adding || !!editingId}
        onClose={() => { setAdding(false); setEditingId(null); setForm({ name: '', type: 'REDDIT', subreddit: '', url: '' }); }}
        title={editingId ? 'Edit source' : 'New source'}
        description="Connect a source without leaving the current list so you can keep reviewing what is already active."
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Source type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. r/entrepreneur"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {selectedType.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs text-muted-foreground">{field.label}</label>
              <input
                value={form[field.key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
          {(create.error || updateSource.error) && <p className="text-sm text-destructive">{((create.error || updateSource.error) as Error).message}</p>}
          <div className="flex gap-2">
            <button disabled={!form.name || create.isPending || updateSource.isPending} onClick={() => editingId ? updateSource.mutate() : create.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
              {create.isPending || updateSource.isPending ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save source' : 'Add source')}
            </button>
            <button onClick={() => { setAdding(false); setEditingId(null); setForm({ name: '', type: 'REDDIT', subreddit: '', url: '' }); }} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
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
              : src.type === 'RSS'
                ? src.config?.url || 'Feed URL not set'
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
