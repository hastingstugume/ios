'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { alertsApi, keywordsApi, organizationsApi, type AlertRule } from '@/lib/api';
import { CATEGORY_META, formatDate } from '@/lib/utils';
import { Bell, Plus, Trash2, ToggleRight, ToggleLeft, Clock, Mail, Search, Pencil, Workflow } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

const FREQ_LABELS: Record<string, string> = {
  IMMEDIATE: 'Immediately',
  HOURLY: 'Hourly digest',
  DAILY: 'Daily digest',
  WEEKLY: 'Weekly digest',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label }));
const STAGE_OPTIONS = [
  { value: '', label: 'Do not move stage' },
  { value: 'IN_PROGRESS', label: 'Move to In progress' },
  { value: 'OUTREACH', label: 'Move to Outreach' },
  { value: 'QUALIFIED', label: 'Move to Qualified' },
];

const ALERT_STARTERS = [
  {
    name: 'High-intent buyer signals',
    minConfidence: 85,
    frequency: 'IMMEDIATE',
    categories: ['BUYING_INTENT', 'RECOMMENDATION_REQUEST'],
    keywordIds: [] as string[],
    description: 'Best for urgent, obvious buying intent and recommendation requests.',
  },
  {
    name: 'Urgent pain and rescue work',
    minConfidence: 75,
    frequency: 'IMMEDIATE',
    categories: ['PAIN_COMPLAINT'],
    keywordIds: [] as string[],
    description: 'Catches blocked teams, migration pain, and implementation rescue signals.',
  },
  {
    name: 'Daily market watch',
    minConfidence: 70,
    frequency: 'DAILY',
    categories: [],
    keywordIds: [] as string[],
    description: 'A calmer digest for teams that want coverage without constant pings.',
  },
];

export default function AlertsPage() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState({
    name: '',
    minConfidence: 75,
    frequency: 'IMMEDIATE',
    emailRecipients: '',
    categories: [] as string[],
    keywordIds: [] as string[],
    autoStage: '',
    autoAssignUserId: '',
    autoNextStep: '',
  });
  const [search, setSearch] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<AlertRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['alerts', currentOrgId],
    queryFn: () => alertsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: memberData } = useQuery({
    queryKey: ['org-members', currentOrgId],
    queryFn: () => organizationsApi.members(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const members = memberData?.members ?? [];

  const resetForm = () => {
    setAdding(false);
    setEditingRule(null);
    setForm({
      name: '',
      minConfidence: 75,
      frequency: 'IMMEDIATE',
      emailRecipients: user?.email || '',
      categories: [],
      keywordIds: [],
      autoStage: '',
      autoAssignUserId: '',
      autoNextStep: '',
    });
  };

  const create = useMutation({
    mutationFn: () => alertsApi.create(currentOrgId!, {
      name: form.name,
      minConfidence: form.minConfidence,
      frequency: form.frequency,
      categories: form.categories,
      keywordIds: form.keywordIds,
      emailRecipients: form.emailRecipients.split(',').map((e) => e.trim()).filter(Boolean),
      autoStage: form.autoStage || undefined,
      autoAssignUserId: form.autoAssignUserId || undefined,
      autoNextStep: form.autoNextStep.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts', currentOrgId] }); resetForm(); },
  });

  const updateRule = useMutation({
    mutationFn: () => alertsApi.update(currentOrgId!, editingRule!.id, {
      name: form.name,
      minConfidence: form.minConfidence,
      frequency: form.frequency,
      categories: form.categories,
      keywordIds: form.keywordIds,
      emailRecipients: form.emailRecipients.split(',').map((e) => e.trim()).filter(Boolean),
      autoStage: form.autoStage || null,
      autoAssignUserId: form.autoAssignUserId || null,
      autoNextStep: form.autoNextStep.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts', currentOrgId] }); resetForm(); },
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

  const keywordLabelMap = useMemo(() => Object.fromEntries(keywords.map((keyword) => [keyword.id, keyword.phrase])), [keywords]);

  const toggleSelection = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const summarizeRuleScope = (rule: Pick<AlertRule, 'categories' | 'keywordIds' | 'minConfidence'>) => {
    const categorySummary = rule.categories.length
      ? rule.categories.map((category) => CATEGORY_META[category]?.label || category).join(', ')
      : 'all categories';
    const keywordSummary = rule.keywordIds.length
      ? `${rule.keywordIds.length} tracked keyword${rule.keywordIds.length === 1 ? '' : 's'}`
      : 'any tracked keyword';

    return `Score ${rule.minConfidence}%+, ${categorySummary}, ${keywordSummary}.`;
  };

  const summarizeAutomation = (rule: Pick<AlertRule, 'autoStage' | 'autoAssignUserId' | 'autoNextStep'>) => {
    const parts: string[] = [];

    if (rule.autoStage) {
      const stageLabel = STAGE_OPTIONS.find((option) => option.value === rule.autoStage)?.label.replace('Move to ', '') || rule.autoStage;
      parts.push(`move to ${stageLabel.toLowerCase()}`);
    }

    if (rule.autoAssignUserId) {
      const member = members.find((item) => item.userId === rule.autoAssignUserId);
      parts.push(`assign ${member?.user.name || member?.user.email || 'owner'}`);
    }

    if (rule.autoNextStep) {
      parts.push(`next step: ${rule.autoNextStep}`);
    }

    return parts.length ? parts.join(' · ') : null;
  };

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Alerts</h1>
            <p className="mt-2 text-base text-muted-foreground">Route the right signals to the right people with confidence, category, and keyword rules.</p>
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
          onClick={() => { resetForm(); setAdding(true); }}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
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
          <p className="text-sm text-muted-foreground">Use categories and keywords together when the same source covers many different intent types.</p>
        </div>
      </section>

      <section className="section-card p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Quick-start alert presets</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start from a common rule, then fine-tune recipients, keywords, and categories.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {ALERT_STARTERS.map((starter) => (
              <button
                key={starter.name}
                type="button"
                onClick={() => {
                  setEditingRule(null);
                  setForm((current) => ({
                    ...current,
                    name: starter.name,
                    minConfidence: starter.minConfidence,
                    frequency: starter.frequency,
                    emailRecipients: current.emailRecipients || user?.email || '',
                    categories: starter.categories,
                    keywordIds: starter.keywordIds,
                    autoStage: '',
                    autoAssignUserId: '',
                    autoNextStep: '',
                  }));
                  setAdding(true);
                }}
                className="rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/20 hover:bg-accent"
              >
                <p className="text-sm font-medium text-foreground">{starter.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{starter.description}</p>
                <p className="mt-3 text-xs text-primary">Use preset</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Modal
        open={adding || !!editingRule}
        onClose={resetForm}
        title={editingRule ? 'Edit alert rule' : 'New alert rule'}
        description="Create and refine alert rules without losing your place in the existing rule list."
      >
        <div className="space-y-4">
          <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            placeholder="Rule name (e.g. High-confidence buying intent)"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Min confidence: {form.minConfidence}%</label>
              <input type="range" min={0} max={100} value={form.minConfidence}
                onChange={(e) => setForm((current) => ({ ...current, minConfidence: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((current) => ({ ...current, frequency: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs text-muted-foreground">Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, categories: toggleSelection(current.categories, option.value) }))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    form.categories.includes(option.value)
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs text-muted-foreground">Keywords</label>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button
                  key={keyword.id}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, keywordIds: toggleSelection(current.keywordIds, keyword.id) }))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    form.keywordIds.includes(keyword.id)
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {keyword.phrase}
                </button>
              ))}
              {!keywords.length && <p className="text-sm text-muted-foreground">Add keywords first to target alert rules more precisely.</p>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Email recipients (comma-separated)</label>
            <input value={form.emailRecipients} onChange={(e) => setForm((current) => ({ ...current, emailRecipients: e.target.value }))}
              placeholder="alice@co.io, bob@co.io"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Workflow className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Workflow automation</p>
                  <p className="mt-1 text-sm text-muted-foreground">Optionally move a matching signal into the pipeline, assign an owner, and prepare the next step automatically.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Move stage</label>
                    <select
                      value={form.autoStage}
                      onChange={(e) => setForm((current) => ({ ...current, autoStage: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {STAGE_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Assign owner</label>
                    <select
                      value={form.autoAssignUserId}
                      onChange={(e) => setForm((current) => ({ ...current, autoAssignUserId: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Do not auto-assign</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.userId}>
                          {member.user.name || member.user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Suggested next step</label>
                  <input
                    value={form.autoNextStep}
                    onChange={(e) => setForm((current) => ({ ...current, autoNextStep: e.target.value }))}
                    placeholder="Review and draft outreach within 15 minutes"
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Automation only fills untouched workflow fields, so manual triage already underway stays intact.</p>
              </div>
            </div>
          </div>
          {(create.error || updateRule.error) && <p className="text-sm text-destructive">{((create.error || updateRule.error) as Error).message}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button disabled={!form.name || !form.emailRecipients || create.isPending || updateRule.isPending} onClick={() => editingRule ? updateRule.mutate() : create.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
              {create.isPending || updateRule.isPending ? (editingRule ? 'Saving…' : 'Creating…') : (editingRule ? 'Save rule' : 'Create rule')}
            </button>
            <button onClick={resetForm} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteCandidate}
        onClose={() => {
          if (remove.isPending) return;
          setDeleteCandidate(null);
        }}
        title="Delete alert rule?"
        description={
          deleteCandidate
            ? `${deleteCandidate.name} will stop sending notifications for this workspace.`
            : 'This alert rule will stop sending notifications for this workspace.'
        }
        size="compact"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            This can’t be undone. You can create a new rule later if needed.
          </div>
          {remove.error ? <p className="text-sm text-destructive">{(remove.error as Error).message}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteCandidate(null)}
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
              {remove.isPending ? 'Deleting…' : 'Delete rule'}
            </button>
          </div>
        </div>
      </Modal>

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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
                  </div>
                  {!!rule.categories.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.categories.map((category) => (
                        <span key={category} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                          {CATEGORY_META[category]?.label || category}
                        </span>
                      ))}
                    </div>
                  )}
                  {!!rule.keywordIds.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.keywordIds.map((keywordId) => (
                        <span key={keywordId} className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                          {keywordLabelMap[keywordId] || 'Unknown keyword'}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 rounded-lg border border-border bg-secondary px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rule scope</p>
                    <p className="mt-1 text-sm text-foreground/85">{summarizeRuleScope(rule)}</p>
                  </div>
                  {summarizeAutomation(rule) ? (
                    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary/80">Workflow automation</p>
                      <p className="mt-1 text-sm text-foreground/85">{summarizeAutomation(rule)}</p>
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-lg border border-border bg-secondary px-4 py-3">
                    <p className="text-xs text-muted-foreground">Recipients</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground/85">{rule.emailRecipients.join(', ')}</p>
                  </div>
                  {rule.lastTriggeredAt && (
                    <p className="mt-3 text-xs text-muted-foreground">Last triggered {formatDate(rule.lastTriggeredAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={() => {
                      setAdding(false);
                      setEditingRule(rule);
                      setForm({
                        name: rule.name,
                        minConfidence: rule.minConfidence,
                        frequency: rule.frequency,
                        emailRecipients: rule.emailRecipients.join(', '),
                        categories: rule.categories,
                        keywordIds: rule.keywordIds,
                        autoStage: rule.autoStage || '',
                        autoAssignUserId: rule.autoAssignUserId || '',
                        autoNextStep: rule.autoNextStep || '',
                      });
                    }}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggle.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    {rule.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setDeleteCandidate(rule)}
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
