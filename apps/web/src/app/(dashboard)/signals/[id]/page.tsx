'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { signalsApi } from '@/lib/api';
import { CATEGORY_META, SOURCE_TYPE_META, getConfidenceColor, getConfidenceBg, formatDate, cn } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Check, Bookmark, EyeOff, SendHorizonal, Lightbulb, FileText, Zap, User } from 'lucide-react';
import Link from 'next/link';

export default function SignalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentOrgId } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const { data: signal, isLoading } = useQuery({
    queryKey: ['signal', currentOrgId, id],
    queryFn: () => signalsApi.get(currentOrgId!, id),
    enabled: !!currentOrgId && !!id,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => signalsApi.updateStatus(currentOrgId!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signal', currentOrgId, id] }),
  });

  const addAnnotation = useMutation({
    mutationFn: (n: string) => signalsApi.addAnnotation(currentOrgId!, id, n),
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['signal', currentOrgId, id] });
    },
  });

  if (isLoading) return (
    <div className="p-6 space-y-4 animate-pulse max-w-3xl">
      <div className="h-6 bg-secondary rounded w-32" />
      <div className="h-40 bg-card border border-border rounded-xl" />
      <div className="h-64 bg-card border border-border rounded-xl" />
    </div>
  );

  if (!signal) return (
    <div className="p-6 text-center text-muted-foreground">Signal not found.</div>
  );

  const cat = CATEGORY_META[signal.category || 'OTHER'] || CATEGORY_META.OTHER;
  const sourceType = SOURCE_TYPE_META[signal.source?.type || ''];

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

  return (
    <div className="p-6 max-w-3xl space-y-5 animate-fade-in">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to feed
      </button>

      {/* Hero card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded border', cat.bg, cat.color)}>
              {cat.label}
            </span>
            {signal.source && (
              <span className="text-xs text-muted-foreground">{sourceType?.icon} {signal.source.name}</span>
            )}
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

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          {signal.authorHandle && <span>@{signal.authorHandle}</span>}
          <span>{formatDate(signal.publishedAt || signal.fetchedAt)}</span>
          {signal.sourceUrl && (
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-primary hover:underline ml-auto">
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
      </div>

      {/* Why it matters */}
      {signal.whyItMatters && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Why This Matters</h2>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{signal.whyItMatters}</p>
        </div>
      )}

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

        <div className="flex gap-2">
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
