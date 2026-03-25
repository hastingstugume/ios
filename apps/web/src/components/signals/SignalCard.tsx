'use client';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Signal, signalsApi } from '@/lib/api';
import { CATEGORY_META, STATUS_META, SOURCE_TYPE_META, getConfidenceColor, getConfidenceBg, formatDate, cn } from '@/lib/utils';
import { Bookmark, EyeOff, Check, ExternalLink, MessageSquare, ChevronRight } from 'lucide-react';

interface SignalCardProps {
  signal: Signal;
  orgId: string;
  queryKey: any[];
}

export function SignalCard({ signal, orgId, queryKey }: SignalCardProps) {
  const qc = useQueryClient();
  const cat = CATEGORY_META[signal.category || 'OTHER'] || CATEGORY_META.OTHER;
  const sourceType = SOURCE_TYPE_META[signal.source?.type || ''];

  const updateStatus = useMutation({
    mutationFn: (status: string) => signalsApi.updateStatus(orgId, signal.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const isIgnored = signal.status === 'IGNORED';

  return (
    <div className={cn(
      'group bg-card border border-border rounded-xl transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/20',
      isIgnored && 'opacity-50 hover:opacity-70',
    )}>
      {/* Top row */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Confidence score */}
        <div className={cn('flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 shrink-0 min-w-[52px]', getConfidenceBg(signal.confidenceScore))}>
          <span className={cn('text-lg font-bold tabular-nums leading-none', getConfidenceColor(signal.confidenceScore))}>
            {signal.confidenceScore ?? '—'}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">score</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Category + source */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border', cat.bg, cat.color)}>
              {cat.label}
            </span>
            {signal.source && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                {sourceType?.icon} {signal.source.name}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(signal.fetchedAt)}</span>
          </div>

          {/* Title */}
          <Link href={`/signals/${signal.id}`}>
            <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 cursor-pointer">
              {signal.originalTitle || signal.normalizedText?.slice(0, 100) || 'Untitled signal'}
            </h3>
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {signal.normalizedText || signal.originalText?.slice(0, 200)}
        </p>

        {/* Why it matters */}
        {signal.whyItMatters && (
          <div className="mt-2.5 flex gap-2 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
            <span className="text-primary text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5">Why</span>
            <p className="text-xs text-foreground/80 leading-relaxed">{signal.whyItMatters}</p>
          </div>
        )}

        {/* Keywords */}
        {signal.keywords && signal.keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {signal.keywords.slice(0, 4).map(({ keyword }) => (
              <span key={keyword.id} className="text-[10px] bg-secondary border border-border text-muted-foreground px-1.5 py-0.5 rounded">
                {keyword.phrase}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60">
        <div className="flex items-center gap-1">
          {/* Save */}
          <button
            onClick={() => updateStatus.mutate(signal.status === 'SAVED' ? 'NEW' : 'SAVED')}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors',
              signal.status === 'SAVED'
                ? 'bg-green-400/10 text-green-400 border border-green-400/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Check className="w-3 h-3" />
            {signal.status === 'SAVED' ? 'Saved' : 'Save'}
          </button>

          {/* Bookmark */}
          <button
            onClick={() => updateStatus.mutate(signal.status === 'BOOKMARKED' ? 'NEW' : 'BOOKMARKED')}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors',
              signal.status === 'BOOKMARKED'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Bookmark className="w-3 h-3" />
            {signal.status === 'BOOKMARKED' ? 'Bookmarked' : 'Bookmark'}
          </button>

          {/* Ignore */}
          <button
            onClick={() => updateStatus.mutate(signal.status === 'IGNORED' ? 'NEW' : 'IGNORED')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            {signal.status === 'IGNORED' ? 'Unignore' : 'Ignore'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {signal._count?.annotations ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
              <MessageSquare className="w-3 h-3" />
              {signal._count.annotations}
            </span>
          ) : null}
          <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <Link href={`/signals/${signal.id}`}
            className="text-muted-foreground hover:text-primary transition-colors p-1">
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
