'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Signal, signalsApi } from '@/lib/api';
import { CATEGORY_META, STAGE_META, formatDate, cn } from '@/lib/utils';
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';

interface LeadCardProps {
  signal: Signal;
  orgId: string;
  queryKey: any[];
}

function getFitTone(score: number | null | undefined) {
  const value = score ?? 0;
  if (value >= 85) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (value >= 70) return 'border-primary/20 bg-primary/10 text-primary';
  if (value >= 55) return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  return 'border-border bg-secondary text-muted-foreground';
}

export function LeadCard({ signal, orgId, queryKey }: LeadCardProps) {
  const qc = useQueryClient();
  const [replyCopied, setReplyCopied] = useState(false);
  const [outreachCopied, setOutreachCopied] = useState(false);
  const stage = STAGE_META[signal.stage] || STAGE_META.TO_REVIEW;
  const category = CATEGORY_META[signal.category || 'OTHER'] || CATEGORY_META.OTHER;
  const fitTone = getFitTone(signal.confidenceScore);
  const prospectName = signal.accountHint || signal.linkedDomain || signal.authorHandle || 'Prospect';
  const primaryIssue = signal.painPoint || signal.whyItMatters || signal.normalizedText || signal.originalText?.slice(0, 160) || 'Potential demand detected.';
  const nextMove = signal.nextStep || signal.suggestedOutreach || signal.suggestedReply || 'Review this lead and decide whether to start outreach.';
  const sourceLine = signal.source?.name || signal.sourceLabel || signal.sourceProfile?.platformLabel || 'Unknown source';

  const updateStatus = useMutation({
    mutationFn: (status: string) => signalsApi.updateStatus(orgId, signal.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: (stageName: string) => signalsApi.updateWorkflow(orgId, signal.id, { stage: stageName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
  });

  const copySuggestedReply = async () => {
    if (!signal.suggestedReply || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(signal.suggestedReply);
    setReplyCopied(true);
    window.setTimeout(() => setReplyCopied(false), 1500);
  };

  const copySuggestedOutreach = async () => {
    if (!signal.suggestedOutreach || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(signal.suggestedOutreach);
    setOutreachCopied(true);
    window.setTimeout(() => setOutreachCopied(false), 1500);
  };

  return (
    <article className="group rounded-2xl border border-border/70 bg-card/80 p-4 transition-all hover:border-border hover:shadow-lg hover:shadow-black/10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', fitTone)}>
                Fit {signal.confidenceScore ?? '—'}
              </span>
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', stage.bg, stage.color)}>
                {stage.label}
              </span>
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', category.bg, category.color)}>
                {category.label}
              </span>
              {signal.freshnessLabel ? (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                  {signal.freshnessLabel}
                </span>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate">{prospectName}</span>
                {signal.locationHint ? (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {signal.locationHint}
                    </span>
                  </>
                ) : null}
              </div>
              <Link href={`/signals/${signal.id}`} className="block">
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                  {signal.originalTitle || 'Untitled lead'}
                </h3>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1">
              <Clock3 className="h-3 w-3" />
              {signal.postedAgo || formatDate(signal.publishedAt || signal.fetchedAt)}
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-1">
              {sourceLine}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-background px-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:items-start">
            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Top issue</p>
                <p className="mt-1 text-sm leading-6 text-foreground/85 line-clamp-3">{primaryIssue}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {signal.serviceHint ? (
                  <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                    {signal.serviceHint}
                  </span>
                ) : null}
                {signal.linkedDomain && signal.linkedDomain !== signal.accountHint ? (
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                    {signal.linkedDomain}
                  </span>
                ) : null}
                {(signal.toolHints || []).slice(0, 2).map((tool) => (
                  <span key={tool} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                    {tool}
                  </span>
                ))}
                {(signal.rankingReasons || []).slice(0, 1).map((reason) => (
                  <span key={reason} className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
                    <Sparkles className="h-3 w-3" />
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next move</p>
                <p className="mt-1 text-sm leading-6 text-foreground/85 line-clamp-2">{nextMove}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updateWorkflow.isPending}
                  onClick={() => updateWorkflow.mutate('OUTREACH')}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  Start outreach
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus.mutate(signal.status === 'SAVED' ? 'NEW' : 'SAVED')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    signal.status === 'SAVED'
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {signal.status === 'SAVED' ? 'Saved' : 'Save lead'}
                </button>
                <Link
                  href={`/signals/${signal.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Open lead
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {signal.suggestedReply ? (
                  <button
                    type="button"
                    onClick={copySuggestedReply}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {replyCopied ? 'Opener copied' : 'Copy opener'}
                  </button>
                ) : null}
                {signal.suggestedOutreach ? (
                  <button
                    type="button"
                    onClick={copySuggestedOutreach}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {outreachCopied ? 'Angle copied' : 'Copy angle'}
                  </button>
                ) : null}
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Source
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
