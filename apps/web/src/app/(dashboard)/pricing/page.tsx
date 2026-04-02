'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getUpgradeContactHref, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP, WORKSPACE_PLAN_ORDER, WORKSPACE_PLANS } from '@/lib/plans';
import { Check, CreditCard, Sparkles } from 'lucide-react';

const PLAN_OUTCOMES: Record<string, string> = {
  free: 'Meet Opportunity Scanner',
  starter: 'Validate demand and start consistent outreach',
  growth: 'Scale qualified pipeline with faster response loops',
  scale: 'Higher limits, team controls, and priority support',
};

export default function PricingPage() {
  const { currentOrg } = useAuth();
  const currentPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const currentPlanIndex = WORKSPACE_PLAN_ORDER.indexOf(currentPlan);
  const [segment, setSegment] = useState<'individual' | 'team'>('individual');
  const upgradeContactHref = getUpgradeContactHref({
    workspaceName: currentOrg?.name,
    currentPlan,
  });
  const plans = useMemo(
    () => WORKSPACE_PLANS.filter((plan) => (segment === 'individual'
      ? ['free', 'starter', 'growth'].includes(plan.key)
      : ['growth', 'scale'].includes(plan.key))),
    [segment],
  );

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
                      <a
                        href={getUpgradeContactHref({
                          workspaceName: currentOrg?.name,
                          currentPlan,
                          targetPlan: plan.key,
                        })}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Get {plan.label}
                      </a>
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
                      Sales-assisted activation
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
              href="/settings#plan-management"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              View limits in settings
            </Link>
            <a
              href={upgradeContactHref}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Talk to billing
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
