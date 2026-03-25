'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { sourcesApi } from '@/lib/api';
import { SOURCE_TYPE_META, formatDate } from '@/lib/utils';
import { Database, Plus, Trash2, PauseCircle, PlayCircle, AlertCircle, CheckCircle2, X } from 'lucide-react';

const SOURCE_TYPES = [
  { value: 'REDDIT', label: 'Reddit Subreddit', fields: [{ key: 'subreddit', label: 'Subreddit name', placeholder: 'entrepreneur' }] },
  { value: 'RSS', label: 'RSS / Atom Feed', fields: [{ key: 'url', label: 'Feed URL', placeholder: 'https://hnrss.org/ask' }] },
  { value: 'MANUAL', label: 'Manual Import', fields: [] },
];

export default function SourcesPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'REDDIT', subreddit: '', url: '' });

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

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => sourcesApi.update(currentOrgId!, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => sourcesApi.delete(currentOrgId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources', currentOrgId] }),
  });

  const selectedType = SOURCE_TYPES.find((t) => t.value === form.type)!;

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sources</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure where to discover signals</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add source
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-foreground">New source</h3>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Source type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Display name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. r/entrepreneur" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
          </div>
          {selectedType.fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
              <input
                value={form[field.key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button disabled={!form.name || create.isPending} onClick={() => create.mutate()}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
              {create.isPending ? 'Adding…' : 'Add source'}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Sources list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : !sources.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Database className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No sources yet — add Reddit subreddits or RSS feeds.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((src) => {
            const typeMeta = SOURCE_TYPE_META[src.type] || { label: src.type, icon: '🔗' };
            return (
              <div key={src.id} className="group flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-border/80 transition-colors">
                <span className="text-xl">{typeMeta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${src.status === 'PAUSED' ? 'text-muted-foreground' : 'text-foreground'}`}>{src.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{typeMeta.label}</span>
                    {src._count?.signals ? (
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">{src._count.signals} signals</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {src.status === 'ERROR' ? (
                      <span className="flex items-center gap-1 text-[10px] text-destructive"><AlertCircle className="w-3 h-3" />{src.errorMessage?.slice(0, 60)}</span>
                    ) : src.status === 'ACTIVE' ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400"><CheckCircle2 className="w-3 h-3" />Active · Last fetch {formatDate(src.lastFetchedAt)}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Paused</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleStatus.mutate({ id: src.id, status: src.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                    title={src.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                  >
                    {src.status === 'ACTIVE' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4 text-green-400" />}
                  </button>
                  <button
                    onClick={() => confirm('Delete this source and all its signals?') && remove.mutate(src.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
