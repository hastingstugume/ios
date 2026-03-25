'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { alertsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Bell, Plus, Trash2, ToggleRight, ToggleLeft, Clock, X, Mail, Search } from 'lucide-react';

const FREQ_LABELS: Record<string, string> = {
  IMMEDIATE: 'Immediately', HOURLY: 'Hourly digest',
  DAILY: 'Daily digest', WEEKLY: 'Weekly digest',
};

export default function AlertsPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', minConfidence: 75, frequency: 'IMMEDIATE', emailRecipients: '' });
  const [search, setSearch] = useState('');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['alerts', currentOrgId],
    queryFn: () => alertsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const create = useMutation({
    mutationFn: () => alertsApi.create(currentOrgId!, {
      name: form.name,
      minConfidence: form.minConfidence,
      frequency: form.frequency,
      emailRecipients: form.emailRecipients.split(',').map((e) => e.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts', currentOrgId] }); setAdding(false); setForm({ name: '', minConfidence: 75, frequency: 'IMMEDIATE', emailRecipients: '' }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => alertsApi.update(currentOrgId!, id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', currentOrgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => alertsApi.delete(currentOrgId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', currentOrgId] }),
  });

  const filteredRules = rules.filter((rule) => {
    const q = search.toLowerCase();
    return !q || rule.name.toLowerCase().includes(q) || rule.frequency.toLowerCase().includes(q);
  });
  const liveRules = rules.filter((rule) => rule.isActive).length;
  const immediateRules = rules.filter((rule) => rule.frequency === 'IMMEDIATE').length;
  const recipientCount = rules.reduce((sum, rule) => sum + rule.emailRecipients.length, 0);

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Alerts</h1>
            <p className="mt-2 text-base text-muted-foreground">Get notified when high-value signals appear.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{liveRules}</span> active rules
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{immediateRules}</span> immediate
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{recipientCount}</span> recipients
            </div>
          </div>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New rule
        </button>
      </section>

      <section className="section-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alert rules..."
              className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <p className="text-sm text-muted-foreground">Use immediate rules for hot leads and digests for broader monitoring.</p>
        </div>
      </section>

      {adding && (
        <div className="section-card space-y-4 p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">New alert rule</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create a notification lane for the conversations your team never wants to miss.</p>
            </div>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Rule name (e.g. High-confidence buying intent)"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Min confidence: {form.minConfidence}%</label>
              <input type="range" min={0} max={100} value={form.minConfidence}
                onChange={(e) => setForm((f) => ({ ...f, minConfidence: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Email recipients (comma-separated)</label>
            <input value={form.emailRecipients} onChange={(e) => setForm((f) => ({ ...f, emailRecipients: e.target.value }))}
              placeholder="alice@co.io, bob@co.io"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex gap-2">
            <button disabled={!form.name || !form.emailRecipients || create.isPending} onClick={() => create.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
              {create.isPending ? 'Creating…' : 'Create rule'}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />)}</div>
      ) : !filteredRules.length ? (
        <div className="section-card p-10 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No alert rules match this search.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRules.map((rule) => (
            <div key={rule.id} className="section-card px-5 py-5">
              <div className="flex items-start gap-4">
                <span className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border shrink-0 ${
                  rule.isActive ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'
                }`}>
                  <Bell className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-lg font-semibold ${rule.isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{rule.name}</span>
                    {!rule.isActive && <span className="rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">Paused</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Score ≥ {rule.minConfidence}%</span>
                    <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />{FREQ_LABELS[rule.frequency] || rule.frequency}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />{rule.emailRecipients.length} recipient{rule.emailRecipients.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 text-xs ${rule.isActive ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>
                      {rule.isActive ? 'Active' : 'Paused'}
                    </span>
                    {rule.lastTriggeredAt && (
                      <span className="text-xs text-muted-foreground">Last triggered {formatDate(rule.lastTriggeredAt)}</span>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-border bg-secondary px-4 py-3">
                    <p className="text-xs text-muted-foreground">Recipients</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground/85">{rule.emailRecipients.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    {rule.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => confirm('Delete this alert rule?') && remove.mutate(rule.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
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
