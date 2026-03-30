'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { getOnboardingWorkspaceSeed } from '@/lib/auth-page-helpers';
import { useAuth } from '@/hooks/useAuth';
import { Briefcase, UserRound, ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isLoading, isAuthenticated, emailVerified, onboardingCompleted, currentOrg, user } = useAuth();
  const [accountType, setAccountType] = useState<'FREELANCER' | 'BUSINESS'>('BUSINESS');
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
    if (!isLoading && isAuthenticated && !emailVerified) router.replace('/verify-email');
    if (!isLoading && isAuthenticated && onboardingCompleted) router.replace('/dashboard');
  }, [isLoading, isAuthenticated, emailVerified, onboardingCompleted, router]);

  useEffect(() => {
    const nextValue = getOnboardingWorkspaceSeed({
      currentOrgName: currentOrg?.name,
      accountType,
      workspaceName,
      userName: user?.name,
    });

    if (nextValue !== workspaceName) {
      setWorkspaceName(nextValue);
    }
  }, [accountType, currentOrg?.name, user?.name, workspaceName]);

  const complete = useMutation({
    mutationFn: () => authApi.completeOnboarding({ accountType, workspaceName }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.replace('/dashboard');
    },
  });

  if (isLoading || !isAuthenticated || !emailVerified || onboardingCompleted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <AuthShell
      eyebrow="Onboarding"
      title="Let’s set up your workspace"
      description="Choose the setup that best matches how you sell, then create the workspace where your team will review buyer intent."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span>Step 3 of 3</span>
            <span>Set up workspace</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-full rounded-full bg-primary" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setAccountType('FREELANCER')}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              accountType === 'FREELANCER'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/30'
            }`}
          >
            <UserRound className="mb-3 h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Freelancer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Great for solo consultants, contractors, and independent operators tracking opportunities for themselves.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAccountType('BUSINESS')}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              accountType === 'BUSINESS'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/30'
            }`}
          >
            <Briefcase className="mb-3 h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Business</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Best for agencies, consultancies, and teams that want a shared workspace around one business or brand.
            </p>
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">
              {accountType === 'FREELANCER' ? 'Solo business or personal brand name' : 'Business or organization name'}
            </label>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder={accountType === 'FREELANCER' ? 'Alice Thornton Consulting' : 'Acme Growth Agency'}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {accountType === 'FREELANCER'
              ? 'You’ll start with a personal workspace designed for solo outreach, saved signals, and alerts.'
              : 'You’ll start with a shared workspace built for agencies, consultancies, and team-based workflows.'}
          </p>

          {complete.error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(complete.error as Error).message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => complete.mutate()}
            disabled={complete.isPending || !workspaceName.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {complete.isPending ? 'Creating workspace…' : 'Continue to dashboard'}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
