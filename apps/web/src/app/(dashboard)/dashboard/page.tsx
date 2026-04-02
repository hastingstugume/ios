'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/lib/api';
import { getNextPlan, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { CATEGORY_META, STAGE_META, getConfidenceColor, formatDate } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import {
  Zap, TrendingUp, Star, Bell, ArrowUpRight,
  Target, Clock, Bookmark, Workflow, Send, Trophy
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, sub, color = 'text-primary' }: {
  label: string; value: number | string; icon: any; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <div className={`w-7 h-7 rounded-lg bg-current/10 flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentOrgId, currentOrg } = useAuth();
  const currentPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const nextPlan = getNextPlan(currentPlan);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', currentOrgId],
    queryFn: () => dashboardApi.summary(currentOrgId!),
    enabled: !!currentOrgId,
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="page-shell animate-pulse">
      <div className="h-8 bg-secondary rounded w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-secondary rounded-xl" />)}
      </div>
    </div>
  );

  const s = data?.stats || {};

  return (
    <div className="page-shell animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your opportunity pipeline at a glance</p>
        </div>
        <Link href="/feed" className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
          <Zap className="w-3.5 h-3.5" />
          View Feed
        </Link>
      </div>

      {nextPlan ? (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-primary">
              Upgrade to {WORKSPACE_PLAN_MAP[nextPlan].label} to track more sources and catch high-intent signals earlier.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              See upgrade options
            </Link>
          </div>
        </div>
      ) : null}

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="New Today"      value={s.newToday ?? 0}      icon={Clock}      sub="signals discovered"         color="text-blue-400" />
        <StatCard label="This Week"      value={s.newThisWeek ?? 0}   icon={TrendingUp} sub="total signals"              color="text-purple-400" />
        <StatCard label="High Confidence" value={s.highConfidence ?? 0} icon={Target}    sub="score ≥ 80, actionable"     color="text-green-400" />
        <StatCard label="In Progress"    value={s.inProgress ?? 0}    icon={Workflow}   sub="actively being worked"      color="text-cyan-400" />
        <StatCard label="Outreach"       value={s.outreach ?? 0}      icon={Send}       sub="ready for contact"          color="text-amber-400" />
        <StatCard label="Qualified"      value={s.qualified ?? 0}     icon={Bookmark}   sub="worth pursuing"             color="text-violet-400" />
        <StatCard label="Won"            value={s.won ?? 0}           icon={Trophy}     sub="closed opportunities"       color="text-green-400" />
        <StatCard label="Active Alerts"  value={s.activeAlerts ?? 0}  icon={Bell}       sub="notification rules"         color="text-primary" />
        <StatCard label="Total Signals"  value={s.totalSignals ?? 0}  icon={Zap}        sub="all time"                   color="text-slate-300" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Trend chart */}
        <div className="bg-card border border-border rounded-xl p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Signal Volume — Last 30 Days</h2>
              <p className="text-xs text-muted-foreground">Daily discovered signals</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data?.trend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,20%,45%)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,45%)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,14%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(213,31%,70%)' }}
                itemStyle={{ color: 'hsl(217,91%,70%)' }}
              />
              <Area type="monotone" dataKey="count" stroke="hsl(217,91%,60%)" strokeWidth={1.5} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">By Category</h2>
          <div className="space-y-2">
            {(data?.byCategory || []).map((c: any) => {
              const meta = CATEGORY_META[c.category] || CATEGORY_META.OTHER;
              const max = Math.max(...(data?.byCategory || []).map((x: any) => x.count), 1);
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{c.count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${meta.color.replace('text-', 'bg-')}`} style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {!data?.byCategory?.length && <p className="text-xs text-muted-foreground">No signals yet</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Pipeline Stages</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {(data?.byStage || []).map((item: any) => {
            const meta = STAGE_META[item.stage] || STAGE_META.TO_REVIEW;
            return (
              <div key={item.stage} className="rounded-lg border border-border bg-secondary/50 px-3 py-3">
                <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded border ${meta.bg} ${meta.color}`}>
                  {meta.label}
                </span>
                <p className="mt-3 text-2xl font-semibold text-foreground">{item.count}</p>
              </div>
            );
          })}
          {!data?.byStage?.length && <p className="text-xs text-muted-foreground">No pipeline activity yet.</p>}
        </div>
      </div>

      {/* Recent high-confidence */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground">Recent High-Confidence Signals</h2>
          </div>
          <Link href="/feed?minConfidence=80" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {(data?.recentHigh || []).map((signal: any) => (
            <Link key={signal.id} href={`/signals/${signal.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group">
              <div className={`mt-0.5 text-xs font-bold tabular-nums w-8 shrink-0 ${getConfidenceColor(signal.confidenceScore)}`}>
                {signal.confidenceScore}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate group-hover:text-primary transition-colors">
                  {signal.originalTitle || signal.normalizedText?.slice(0, 80) || 'Untitled'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{signal.source?.name}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{formatDate(signal.fetchedAt)}</span>
                </div>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
            </Link>
          ))}
          {!data?.recentHigh?.length && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No high-confidence signals yet — add keywords and sources to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
