'use client';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Signal, signalsApi } from '@/lib/api';
import { CATEGORY_META, SOURCE_TYPE_META, STAGE_META, getConfidenceColor, getConfidenceBg, formatDate, cn } from '@/lib/utils';
import { Bookmark, EyeOff, Check, ExternalLink, MessageSquare, ChevronRight, UserRound, Workflow, Sparkles, Flame } from 'lucide-react';

interface SignalCardProps {
  signal: Signal;
  orgId: string;
  queryKey: any[];
}

export function SignalCard({ signal, orgId, queryKey }: SignalCardProps) {
  const qc = useQueryClient();
  const cat = CATEGORY_META[signal.category || 'OTHER'] || CATEGORY_META.OTHER;
  const stage = STAGE_META[signal.stage] || STAGE_META.TO_REVIEW;
  const sourceType = SOURCE_TYPE_META[signal.source?.type || ''];
  const priorityScore = signal.priorityScore ?? signal.confidenceScore ?? 0;

  const updateStatus = useMutation({
    mutationFn: (status: string) => signalsApi.updateStatus(orgId, signal.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: (stage: string) => signalsApi.updateWorkflow(orgId, signal.id, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
  });

  const isIgnored = signal.status === 'IGNORED';

  return (
    <div className={cn(
      'group bg-card border border-border rounded-xl transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/20',
      isIgnored && 'opacity-60 hover:opacity-80',
    )}>
      <div className="flex items-start gap-4 p-4">
        <div className={cn('flex min-w-[58px] flex-col items-center justify-center rounded-xl border px-2.5 py-2 shrink-0', getConfidenceBg(signal.confidenceScore))}>
          <span className={cn('text-xl font-bold tabular-nums leading-none', getConfidenceColor(signal.confidenceScore))}>
            {signal.confidenceScore ?? '—'}
          </span>
          <span className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">score</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border', cat.bg, cat.color)}>
              {cat.label}
            </span>
            <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border', stage.bg, stage.color)}>
              {stage.label}
            </span>
            {signal.freshnessLabel ? (
              <span className="inline-flex items-center gap-1 rounded border border-primary/15 bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Flame className="h-3 w-3" />
                {signal.freshnessLabel}
              </span>
            ) : null}
            {signal.source && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {sourceType?.icon} {signal.source.name}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">{formatDate(signal.fetchedAt)}</span>
          </div>

          <Link href={`/signals/${signal.id}`}>
            <h3 className="text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {signal.originalTitle || signal.normalizedText?.slice(0, 100) || 'Untitled signal'}
            </h3>
          </Link>

          <p className="text-sm text-muted-foreground leading-7 line-clamp-2 mt-2">
            {signal.normalizedText || signal.originalText?.slice(0, 220)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-1.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Priority {priorityScore}
            </span>
            {(signal.rankingReasons || []).slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[11px] text-muted-foreground">
                {reason}
              </span>
            ))}
          </div>

          {signal.whyItMatters && (
            <div className="mt-3 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-primary uppercase tracking-wide mb-1">Why it matters</p>
              <p className="text-sm text-foreground/80 leading-6 line-clamp-2">{signal.whyItMatters}</p>
            </div>
          )}

          {signal.keywords && signal.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {signal.keywords.slice(0, 4).map(({ keyword }) => (
                <span key={keyword.id} className="text-[11px] bg-secondary border border-border text-muted-foreground px-2 py-1 rounded-md">
                  {keyword.phrase}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="w-3.5 h-3.5" />
              {signal.assignee?.name || signal.assignee?.email || 'Unassigned'}
            </span>
            {signal.nextStep ? (
              <span className="inline-flex items-center gap-1">
                <Workflow className="w-3.5 h-3.5" />
                Next: {signal.nextStep}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
        <div className="flex items-center gap-1 flex-wrap">
          <select
            value={signal.stage}
            disabled={updateWorkflow.isPending}
            onChange={(e) => updateWorkflow.mutate(e.target.value)}
            className="mr-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {Object.entries(STAGE_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
          <button
            onClick={() => updateStatus.mutate(signal.status === 'SAVED' ? 'NEW' : 'SAVED')}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors',
              signal.status === 'SAVED'
                ? 'bg-green-400/10 text-green-400 border border-green-400/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Check className="w-3.5 h-3.5" />
            {signal.status === 'SAVED' ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={() => updateStatus.mutate(signal.status === 'BOOKMARKED' ? 'NEW' : 'BOOKMARKED')}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors',
              signal.status === 'BOOKMARKED'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Bookmark className="w-3.5 h-3.5" />
            {signal.status === 'BOOKMARKED' ? 'Bookmarked' : 'Bookmark'}
          </button>

          <button
            onClick={() => updateStatus.mutate(signal.status === 'IGNORED' ? 'NEW' : 'IGNORED')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            {signal.status === 'IGNORED' ? 'Unignore' : 'Ignore'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {signal._count?.annotations ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {signal._count.annotations}
            </span>
          ) : null}
          <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
            <ExternalLink className="w-4 h-4" />
          </a>
          <Link href={`/signals/${signal.id}`}
            className="text-muted-foreground hover:text-primary transition-colors p-1.5">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
