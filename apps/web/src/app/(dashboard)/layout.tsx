'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { normalizeWorkspacePlan } from '@/lib/plans';
import { Sidebar } from '@/components/layout/Sidebar';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, emailVerified, onboardingCompleted, currentOrg, currentOrgId } = useAuth();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const showUpgradeCTA = currentPlan === 'free';
  const { redirectingPlan, checkoutError, clearCheckoutError, startUpgradeCheckout } = useUpgradeCheckout(currentOrgId);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
    if (!isLoading && isAuthenticated && !emailVerified) router.replace('/verify-email');
    if (!isLoading && isAuthenticated && emailVerified && !onboardingCompleted) router.replace('/onboarding');
  }, [isLoading, isAuthenticated, emailVerified, onboardingCompleted, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !emailVerified || !onboardingCompleted) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar className="hidden md:flex" />

      <div className="md:hidden">
        <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-foreground"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-foreground">Opportunity Scanner</p>
          <div className="w-10" />
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation backdrop"
            />
            <div className="relative z-10 h-full w-72 max-w-[85vw]">
              <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
                <p className="text-sm font-semibold text-foreground">Navigation</p>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-foreground"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Sidebar className="h-[calc(100vh-4rem)] w-full border-r-0" onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto pt-16 md:pt-0">
        {showUpgradeCTA ? (
          <section className="pointer-events-none fixed left-1/2 top-[4.75rem] z-40 -translate-x-1/2 md:top-4">
            <div className="pointer-events-auto rounded-xl border border-border/80 bg-card/95 px-3 py-2 shadow-[0_12px_40px_rgba(2,8,23,0.35)] backdrop-blur-md">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Free plan</span>
                <span className="text-muted-foreground/60">·</span>
                <button
                  type="button"
                  onClick={() => startUpgradeCheckout('starter')}
                  disabled={!!redirectingPlan}
                  className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70"
                >
                  {redirectingPlan === 'starter' ? 'Redirecting…' : 'Upgrade'}
                </button>
              </div>
            </div>
            {checkoutError ? (
              <div className="mt-2 rounded-lg border border-destructive/40 bg-card/95 px-3 py-2 text-xs text-destructive shadow-[0_8px_30px_rgba(2,8,23,0.3)]">
                <div className="flex items-center justify-between gap-3">
                  <span>{checkoutError}</span>
                  <button
                    type="button"
                    onClick={clearCheckoutError}
                    className="rounded-md border border-destructive/40 px-2 py-0.5 transition-colors hover:bg-destructive/10"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {children}
      </main>
    </div>
  );
}
