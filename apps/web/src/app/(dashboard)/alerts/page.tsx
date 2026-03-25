'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { alertsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Bell, Plus, Trash2, ToggleRight, ToggleLeft, Clock, X, Mail } from 'lucide-react';

const FREQ_LABELS: Record<string, string> = {
  IMMEDIATE: 'Immediately', HOURLY: 'Hourly digest',
  DAILY: 'Daily digest', WEEKLY: 'Weekly digest',
};

export default function AlertsPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', minConfidence: 75, frequency: 'IMMEDIATE', emailRecipients: '' });

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

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Get notified when high-value signals appear</p>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          <Plus className="w-4 h-4" /> New rule
        </button>
      </div>

      {adding && (
        <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">New alert rule</h3>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Rule name (e.g. High-confidence buying intent)"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min confidence: {form.minConfidence}%</label>
              <input type="range" min={0} max={100} value={form.minConfidence}
                onChange={(e) => setForm((f) => ({ ...f, minConfidence: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email recipients (comma-separated)</label>
            <input value={form.emailRecipients} onChange={(e) => setForm((f) => ({ ...f, emailRecipients: e.target.value }))}
              placeholder="alice@co.io, bob@co.io"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <div className="flex gap-2">
            <button disabled={!form.name || !form.emailRecipients || create.isPending} onClick={() => create.mutate()}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
              {create.isPending ? 'Creating…' : 'Create rule'}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : !rules.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No alert rules yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="group bg-card border border-border rounded-xl px-4 py-3 hover:border-border/80 transition-colors">
              <div className="flex items-start gap-3">
                <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${rule.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${rule.isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{rule.name}</span>
                    {!rule.isActive && <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">Paused</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">Score ≥ {rule.minConfidence}%</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{FREQ_LABELS[rule.frequency] || rule.frequency}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />{rule.emailRecipients.length} recipient{rule.emailRecipients.length !== 1 ? 's' : ''}
                    </span>
                    {rule.lastTriggeredAt && (
                      <span className="text-xs text-muted-foreground">Last triggered {formatDate(rule.lastTriggeredAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggle.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                    {rule.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => confirm('Delete this alert rule?') && remove.mutate(rule.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
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
