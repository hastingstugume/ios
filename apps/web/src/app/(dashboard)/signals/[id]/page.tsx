'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { organizationsApi, signalsApi } from '@/lib/api';
import { CATEGORY_META, SOURCE_TYPE_META, STAGE_META, getConfidenceColor, getConfidenceBg, formatDate, cn } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Check, Bookmark, EyeOff, SendHorizonal, Lightbulb, FileText, Zap, User, Workflow, UserRound, CalendarCheck, Sparkles, Flame, Reply, Clock3 } from 'lucide-react';

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toIsoOrNull(localValue: string) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function SignalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentOrgId } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [nextStepDraft, setNextStepDraft] = useState('');
  const [firstResponseDraft, setFirstResponseDraft] = useState('');
  const [meetingBookedDraft, setMeetingBookedDraft] = useState('');
  const [pipelineValueDraft, setPipelineValueDraft] = useState('');
  const [hoursSavedDraft, setHoursSavedDraft] = useState('');
  const [outcomeNotesDraft, setOutcomeNotesDraft] = useState('');
  const [replyCopied, setReplyCopied] = useState(false);

  const { data: signal, isLoading } = useQuery({
    queryKey: ['signal', currentOrgId, id],
    queryFn: () => signalsApi.get(currentOrgId!, id),
    enabled: !!currentOrgId && !!id,
  });

  const { data: memberData } = useQuery({
    queryKey: ['org-members', currentOrgId],
    queryFn: () => organizationsApi.members(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => signalsApi.updateStatus(currentOrgId!, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signal', currentOrgId, id] });
      qc.invalidateQueries({ queryKey: ['signals', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', currentOrgId] });
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: (data: {
      stage?: string;
      assigneeId?: string | null;
      nextStep?: string | null;
      firstResponseAt?: string | null;
      meetingBookedAt?: string | null;
      pipelineValueUsd?: number | null;
      estimatedHoursSaved?: number | null;
      outcomeNotes?: string | null;
    }) =>
      signalsApi.updateWorkflow(currentOrgId!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signal', currentOrgId, id] });
      qc.invalidateQueries({ queryKey: ['signals', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', currentOrgId] });
    },
  });

  const addAnnotation = useMutation({
    mutationFn: (n: string) => signalsApi.addAnnotation(currentOrgId!, id, n),
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['signal', currentOrgId, id] });
    },
  });

  useEffect(() => {
    setNextStepDraft(signal?.nextStep || '');
  }, [signal?.nextStep]);

  useEffect(() => {
    setFirstResponseDraft(toLocalDateTimeInput(signal?.firstResponseAt));
    setMeetingBookedDraft(toLocalDateTimeInput(signal?.meetingBookedAt));
    setPipelineValueDraft(signal?.pipelineValueUsd === null || signal?.pipelineValueUsd === undefined ? '' : String(signal.pipelineValueUsd));
    setHoursSavedDraft(signal?.estimatedHoursSaved === null || signal?.estimatedHoursSaved === undefined ? '' : String(signal.estimatedHoursSaved));
    setOutcomeNotesDraft(signal?.outcomeNotes || '');
  }, [
    signal?.firstResponseAt,
    signal?.meetingBookedAt,
    signal?.pipelineValueUsd,
    signal?.estimatedHoursSaved,
    signal?.outcomeNotes,
  ]);

  if (isLoading) return (
    <div className="page-shell max-w-4xl space-y-4 animate-pulse">
      <div className="h-6 bg-secondary rounded w-32" />
      <div className="h-40 bg-card border border-border rounded-xl" />
      <div className="h-64 bg-card border border-border rounded-xl" />
    </div>
  );

  if (!signal) return (
    <div className="page-shell max-w-4xl text-center text-muted-foreground">Signal not found.</div>
  );

  const cat = CATEGORY_META[signal.category || 'OTHER'] || CATEGORY_META.OTHER;
  const stage = STAGE_META[signal.stage] || STAGE_META.TO_REVIEW;
  const sourceType = SOURCE_TYPE_META[signal.source?.type || ''];
  const priorityScore = signal.priorityScore ?? signal.confidenceScore ?? 0;
  const sourceLabel = signal.source?.name || signal.sourceLabel || signal.sourceProfile?.platformLabel || 'Unknown source';
  const supportBadgeClass = signal.sourceProfile?.supportStatus === 'production_ready'
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    : signal.sourceProfile?.supportStatus === 'limited'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
      : signal.sourceProfile?.supportStatus === 'legacy'
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : 'border-border bg-secondary text-muted-foreground';

  const actionBtn = (status: 'SAVED' | 'BOOKMARKED' | 'IGNORED', icon: any, label: string, activeClass: string) => {
    const Icon = icon;
    const active = signal.status === status;
    return (
      <button
        onClick={() => updateStatus.mutate(active ? 'NEW' : status)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
          active ? activeClass : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
        )}
      >
        <Icon className="w-4 h-4" />
        {active ? label : label.replace('Mark ', '').replace('as ', '')}
      </button>
    );
  };

  const copySuggestedReply = async () => {
    if (!signal?.suggestedReply || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(signal.suggestedReply);
    setReplyCopied(true);
    window.setTimeout(() => setReplyCopied(false), 1500);
  };

  return (
    <div className="page-shell max-w-4xl space-y-5 animate-fade-in">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to feed
      </button>

      {/* Hero card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded border', cat.bg, cat.color)}>
              {cat.label}
            </span>
            <span className={cn('inline-flex items-center text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded border', stage.bg, stage.color)}>
              {stage.label}
            </span>
          </div>
          <div className={cn('flex flex-col items-center px-3 py-2 rounded-xl border shrink-0', getConfidenceBg(signal.confidenceScore))}>
            <span className={cn('text-2xl font-bold tabular-nums', getConfidenceColor(signal.confidenceScore))}>
              {signal.confidenceScore ?? '—'}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">confidence</span>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-foreground leading-snug mb-2">
          {signal.originalTitle || 'Untitled signal'}
        </h1>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span>{sourceType?.icon}</span>
            <span>{sourceLabel}</span>
          </span>
          {signal.sourceProfile ? (
            <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {signal.sourceProfile.badgeLabel}
            </span>
          ) : null}
          {signal.sourceProfile ? (
            <span className={cn('rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide', supportBadgeClass)}>
              {signal.sourceProfile.supportStatus.replaceAll('_', ' ')}
            </span>
          ) : null}
          {signal.authorHandle && <span>@{signal.authorHandle}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5" />
            Posted {signal.postedAgo || formatDate(signal.publishedAt || signal.fetchedAt)}
          </span>
          <span>{signal.assignee?.name || signal.assignee?.email || 'Unassigned'}</span>
          {signal.freshnessLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-primary">
              <Flame className="h-3 w-3" />
              {signal.freshnessLabel}
            </span>
          ) : null}
          {signal.sourceUrl && (
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-primary hover:underline sm:ml-auto">
              View original <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {actionBtn('SAVED', Check, 'Save', 'bg-green-400/10 border-green-400/30 text-green-400')}
          {actionBtn('BOOKMARKED', Bookmark, 'Bookmark', 'bg-amber-400/10 border-amber-400/30 text-amber-400')}
          {actionBtn('IGNORED', EyeOff, 'Ignore', 'bg-secondary border-border text-muted-foreground')}
        </div>

        <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/15 bg-background px-2.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Priority {priorityScore}
            </span>
            {(signal.rankingReasons || []).slice(0, 2).map((reason) => (
              <span key={reason} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                {reason}
              </span>
            ))}
          </div>
        </div>
      </div>

      {(signal.painPoint || signal.urgency || signal.sentiment || signal.conversationType || signal.sourceProfile || signal.accountHint || signal.linkedDomain || signal.serviceHint || signal.locationHint || (signal.toolHints || []).length) ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {signal.serviceHint ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Service hint</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.serviceHint}</p>
            </div>
          ) : null}
          {signal.locationHint ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Location hint</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.locationHint}</p>
            </div>
          ) : null}
          {signal.accountHint ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Account hint</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.accountHint}</p>
            </div>
          ) : null}
          {signal.linkedDomain && signal.linkedDomain !== signal.accountHint ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Linked domain</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.linkedDomain}</p>
            </div>
          ) : null}
          {(signal.toolHints || []).length ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool hints</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.toolHints?.join(', ')}</p>
            </div>
          ) : null}
          {signal.urgency ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Urgency</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.urgency.toLowerCase()} urgency</p>
            </div>
          ) : null}
          {signal.conversationType ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Conversation type</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.conversationType.replaceAll('_', ' ').toLowerCase()}</p>
            </div>
          ) : null}
          {signal.sentiment ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tone</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.sentiment.toLowerCase()}</p>
            </div>
          ) : null}
          {signal.sourceProfile ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source trust</p>
              <p className="mt-2 text-sm font-medium text-foreground">{signal.sourceProfile.supportStatus.replaceAll('_', ' ')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Workflow</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline stage</span>
            <select
              value={signal.stage}
              disabled={updateWorkflow.isPending}
              onChange={(e) => updateWorkflow.mutate({ stage: e.target.value })}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {Object.entries(STAGE_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</span>
            <select
              value={signal.assigneeId || ''}
              disabled={updateWorkflow.isPending}
              onChange={(e) => updateWorkflow.mutate({ assigneeId: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">Unassigned</option>
              {(memberData?.members || []).map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.user.name || member.user.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</label>
          <input
            value={nextStepDraft}
            onChange={(e) => setNextStepDraft(e.target.value)}
            disabled={updateWorkflow.isPending}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value !== (signal.nextStep || '')) {
                updateWorkflow.mutate({ nextStep: value || null });
              }
            }}
            placeholder="Define the next concrete action for this signal"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Outcome tracking</h3>
            <span className="text-[11px] text-muted-foreground">Use real results to measure ROI</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">First response</span>
              <input
                type="datetime-local"
                value={firstResponseDraft}
                disabled={updateWorkflow.isPending}
                onChange={(e) => setFirstResponseDraft(e.target.value)}
                onBlur={(e) => {
                  const nextValue = e.target.value;
                  const currentValue = toLocalDateTimeInput(signal.firstResponseAt);
                  if (nextValue !== currentValue) {
                    updateWorkflow.mutate({ firstResponseAt: toIsoOrNull(nextValue) });
                  }
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Meeting booked</span>
              <input
                type="datetime-local"
                value={meetingBookedDraft}
                disabled={updateWorkflow.isPending}
                onChange={(e) => setMeetingBookedDraft(e.target.value)}
                onBlur={(e) => {
                  const nextValue = e.target.value;
                  const currentValue = toLocalDateTimeInput(signal.meetingBookedAt);
                  if (nextValue !== currentValue) {
                    updateWorkflow.mutate({ meetingBookedAt: toIsoOrNull(nextValue) });
                  }
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pipeline value (USD)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={pipelineValueDraft}
                disabled={updateWorkflow.isPending}
                onChange={(e) => setPipelineValueDraft(e.target.value)}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    if (signal.pipelineValueUsd !== null && signal.pipelineValueUsd !== undefined) {
                      updateWorkflow.mutate({ pipelineValueUsd: null });
                    }
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed)) return;
                  const normalized = Math.max(0, Math.round(parsed));
                  if (normalized !== (signal.pipelineValueUsd ?? null)) {
                    updateWorkflow.mutate({ pipelineValueUsd: normalized });
                  }
                }}
                placeholder="e.g. 2500"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hours saved</span>
              <input
                type="number"
                min={0}
                step={1}
                value={hoursSavedDraft}
                disabled={updateWorkflow.isPending}
                onChange={(e) => setHoursSavedDraft(e.target.value)}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    if (signal.estimatedHoursSaved !== null && signal.estimatedHoursSaved !== undefined) {
                      updateWorkflow.mutate({ estimatedHoursSaved: null });
                    }
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed)) return;
                  const normalized = Math.max(0, Math.round(parsed));
                  if (normalized !== (signal.estimatedHoursSaved ?? null)) {
                    updateWorkflow.mutate({ estimatedHoursSaved: normalized });
                  }
                }}
                placeholder="e.g. 4"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </label>
          </div>

          <div className="mt-3 space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Outcome notes</label>
            <textarea
              value={outcomeNotesDraft}
              disabled={updateWorkflow.isPending}
              onChange={(e) => setOutcomeNotesDraft(e.target.value)}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (signal.outcomeNotes || '')) {
                  updateWorkflow.mutate({ outcomeNotes: value || null });
                }
              }}
              rows={3}
              placeholder="Capture what happened (reply quality, objections, next action, result)."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {updateWorkflow.isPending ? <span>Saving workflow…</span> : null}
          <span className="inline-flex items-center gap-1">
            <UserRound className="w-3.5 h-3.5" />
            Owner: {signal.assignee?.name || signal.assignee?.email || 'None'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5" />
            {signal.firstResponseAt ? `First response ${formatDate(signal.firstResponseAt)}` : 'No response logged'}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarCheck className="w-3.5 h-3.5" />
            {signal.closedAt ? `Closed ${formatDate(signal.closedAt)}` : 'Open opportunity'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            Value {signal.pipelineValueUsd ? `$${signal.pipelineValueUsd.toLocaleString('en-US')}` : '—'}
          </span>
        </div>
      </div>

      {/* Why it matters */}
      {signal.whyItMatters && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Intent Clarity</h2>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{signal.whyItMatters}</p>
        </div>
      )}

      {(signal.painPoint || signal.urgency || signal.sentiment || signal.conversationType) ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Context</h2>
            <div className="space-y-3 text-sm">
              {signal.painPoint ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Pain point</p>
                  <p className="text-foreground/80 leading-relaxed">{signal.painPoint}</p>
                </div>
              ) : null}
            </div>
          </div>

          {signal.sourceProfile ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Source Provenance</h2>
              <div className="space-y-2 text-sm text-foreground/80">
                <p><span className="text-muted-foreground">Platform:</span> {signal.sourceProfile.platformLabel}</p>
                <p><span className="text-muted-foreground">Provider:</span> {signal.sourceProfile.providerLabel}</p>
                <p><span className="text-muted-foreground">Acquisition:</span> {signal.sourceProfile.acquisitionMode.replaceAll('_', ' ')}</p>
                <p><span className="text-muted-foreground">Support:</span> {signal.sourceProfile.supportStatus.replaceAll('_', ' ')}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{signal.sourceProfile.complianceNotes}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Suggested outreach */}
      {signal.suggestedOutreach && (
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-green-400">Suggested Outreach</h2>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{signal.suggestedOutreach}</p>
        </div>
      )}

      {signal.suggestedReply ? (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Reply className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm font-semibold text-emerald-300">Suggested Reply</h2>
            </div>
            <button
              type="button"
              onClick={copySuggestedReply}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              {replyCopied ? 'Copied' : 'Copy reply'}
            </button>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{signal.suggestedReply}</p>
        </div>
      ) : null}

      {/* Original content */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Original Post</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {signal.originalText}
        </p>
      </div>

      {/* Keywords */}
      {signal.keywords && signal.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Matched keywords:</span>
          {signal.keywords.map(({ keyword }) => (
            <span key={keyword.id} className="text-xs bg-secondary border border-border text-muted-foreground px-2 py-1 rounded-lg">
              {keyword.phrase}
            </span>
          ))}
        </div>
      )}

      {/* Annotations */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Notes & Annotations</h2>

        {signal.annotations && signal.annotations.length > 0 && (
          <div className="space-y-3 mb-4">
            {signal.annotations.map((ann) => (
              <div key={ann.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <div className="flex-1 bg-secondary rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{ann.user?.name || 'User'}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(ann.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ann.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && note.trim() && addAnnotation.mutate(note.trim())}
            placeholder="Add a note…"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          />
          <button
            disabled={!note.trim() || addAnnotation.isPending}
            onClick={() => note.trim() && addAnnotation.mutate(note.trim())}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
