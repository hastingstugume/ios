'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { useBillingPortal } from '@/hooks/useBillingPortal';
import { organizationsApi } from '@/lib/api';
import { normalizeWorkspacePlan, WORKSPACE_PLAN_MAP, WORKSPACE_PLAN_ORDER, WORKSPACE_PLANS } from '@/lib/plans';
import { Check, CreditCard, Sparkles } from 'lucide-react';

const PLAN_OUTCOMES: Record<string, string> = {
  free: 'Meet Opportunity Scanner',
  starter: 'Validate demand and start consistent outreach',
  growth: 'Scale qualified pipeline with faster response loops',
  scale: 'Higher limits, team controls, and priority support',
};

export default function PricingPage() {
  const { currentOrg, currentOrgId } = useAuth();
  const usageQuery = useQuery({
    queryKey: ['workspace-usage', currentOrgId],
    queryFn: () => organizationsApi.usage(currentOrgId!),
    enabled: !!currentOrgId,
    refetchInterval: 60_000,
  });
  const usage = usageQuery.data;
  const searchParams = useSearchParams();
  const currentPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const currentPlanIndex = WORKSPACE_PLAN_ORDER.indexOf(currentPlan);
  const [segment, setSegment] = useState<'individual' | 'team'>('individual');
  const {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError,
  } = useUpgradeCheckout(currentOrgId);
  const {
    redirectingToPortal,
    portalError,
    startBillingPortal,
    clearPortalError,
  } = useBillingPortal(currentOrgId);
  const plans = useMemo(
    () => WORKSPACE_PLANS.filter((plan) => (segment === 'individual'
      ? ['free', 'starter', 'growth'].includes(plan.key)
      : ['growth', 'scale'].includes(plan.key))),
    [segment],
  );
  const checkoutState = searchParams.get('checkout');

  return (
    <div className="page-shell animate-fade-in">
      <section className="mx-auto w-full max-w-6xl space-y-10">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <CreditCard className="h-3.5 w-3.5" />
            Pricing
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">Plans that grow with you</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Current plan: <span className="font-medium text-foreground">{WORKSPACE_PLAN_MAP[currentPlan].label}</span>. Move up when you need higher capacity and faster execution.
            </p>
            {usage ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md border border-border bg-card px-2 py-1">
                  Sources {usage.resources.sources.used}/{usage.resources.sources.limit ?? 'unlimited'}
                </span>
                <span className="rounded-md border border-border bg-card px-2 py-1">
                  Keywords {usage.resources.keywords.used}/{usage.resources.keywords.limit ?? 'unlimited'}
                </span>
                <span className="rounded-md border border-border bg-card px-2 py-1">
                  Alerts {usage.resources.alerts.used}/{usage.resources.alerts.limit ?? 'unlimited'}
                </span>
              </div>
            ) : null}
          </div>
          <div className="inline-flex rounded-2xl border border-border bg-card p-1.5">
            <button
              type="button"
              onClick={() => setSegment('individual')}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                segment === 'individual'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setSegment('team')}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                segment === 'team'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Team and Enterprise
            </button>
          </div>
          {currentPlan !== 'free' ? (
            <div>
              <button
                type="button"
                onClick={() => startBillingPortal({ returnPath: '/pricing' })}
                disabled={redirectingToPortal}
                className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {redirectingToPortal ? 'Redirecting...' : 'Manage billing and invoices'}
              </button>
            </div>
          ) : null}
          {checkoutState === 'success' ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Checkout completed. Your workspace plan will update in-app in a few moments.
            </div>
          ) : null}
          {checkoutState === 'cancelled' ? (
            <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Checkout was cancelled. You can restart whenever you are ready.
            </div>
          ) : null}
          {checkoutError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{checkoutError}</span>
                <button
                  type="button"
                  onClick={clearCheckoutError}
                  className="inline-flex items-center justify-center rounded-md border border-destructive/40 px-2.5 py-1 text-xs transition-colors hover:bg-destructive/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          {portalError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{portalError}</span>
                <button
                  type="button"
                  onClick={clearPortalError}
                  className="inline-flex items-center justify-center rounded-md border border-destructive/40 px-2.5 py-1 text-xs transition-colors hover:bg-destructive/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={`grid gap-6 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {plans.map((plan) => {
            const planIndex = WORKSPACE_PLAN_ORDER.indexOf(plan.key);
            const isCurrent = plan.key === currentPlan;
            const isUpgrade = planIndex > currentPlanIndex;
            const isFeatured = plan.featured;
            const priceSuffix = plan.key === 'scale'
              ? 'starting from'
              : plan.key === 'growth'
                ? 'per workspace / month'
                : 'per workspace / month';

            return (
              <article
                key={plan.key}
                className={`flex h-full min-h-[560px] flex-col overflow-hidden rounded-3xl border transition-all duration-200 ${
                  isFeatured
                    ? 'border-primary/35 bg-primary/[0.04] shadow-[0_10px_40px_rgba(59,130,246,0.12)]'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="px-7 py-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary">
                      <Sparkles className="h-5 w-5 text-foreground/90" />
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary">
                        Current
                      </span>
                    ) : null}
                  </div>

                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">{plan.label}</h2>
                  <p className="mt-2 min-h-[44px] text-sm leading-6 text-muted-foreground">
                    {PLAN_OUTCOMES[plan.key] || plan.summary}
                  </p>

                  <div className="mt-6">
                    <p className="text-5xl font-semibold tracking-tight text-foreground">{plan.price}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {priceSuffix}
                      {plan.key === 'scale' ? ` · ${plan.priceNote}` : ''}
                    </p>
                  </div>

                  <div className="mt-7">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-base font-medium text-primary"
                      >
                        You are on this plan
                      </button>
                    ) : isUpgrade ? (
                      <button
                        type="button"
                        onClick={() => startUpgradeCheckout(plan.key)}
                        disabled={!!redirectingPlan}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {redirectingPlan === plan.key ? 'Redirecting…' : `Get ${plan.label}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-base font-medium text-muted-foreground"
                      >
                        Included in your current tier
                      </button>
                    )}
                    <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                      Instant secure checkout
                    </p>
                  </div>
                </div>
                <div className="border-t border-border" />
                <div className="flex-1 px-7 py-6">
                  <p className="mb-3 text-sm font-medium text-foreground">
                    {plan.key === 'free'
                      ? 'Includes:'
                      : `Everything in ${plan.key === 'starter' ? 'Free' : 'Starter'}, plus:`}
                  </p>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-foreground/80" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <div className="section-card p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Want help picking the right tier?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us your goals and timeline, and we will recommend the fastest path to qualified pipeline growth.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/settings#plan-limits"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              See current limits
            </Link>
            {currentOrgId ? (
              <button
                type="button"
                onClick={() => {
                  const nextPlan = WORKSPACE_PLAN_ORDER[currentPlanIndex + 1];
                  if (!nextPlan || nextPlan === 'free') return;
                  startUpgradeCheckout(nextPlan);
                }}
                disabled={!!redirectingPlan || !WORKSPACE_PLAN_ORDER[currentPlanIndex + 1]}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {redirectingPlan
                  ? 'Redirecting…'
                  : WORKSPACE_PLAN_ORDER[currentPlanIndex + 1]
                    ? `Upgrade to ${WORKSPACE_PLAN_MAP[WORKSPACE_PLAN_ORDER[currentPlanIndex + 1]].label}`
                    : 'You are on the highest plan'}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
