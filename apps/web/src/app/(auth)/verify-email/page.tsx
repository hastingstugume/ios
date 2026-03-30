'use client';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { getVerifyEmailMode } from '@/lib/auth-page-helpers';
import { MailCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

function VerifyEmailContent() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);

  const verify = useMutation({
    mutationFn: (verificationToken: string) => authApi.verifyEmail(verificationToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.replace('/onboarding');
    },
  });

  const resend = useMutation({
    mutationFn: (targetEmail: string) => authApi.resendVerification(targetEmail),
  });

  const mode = useMemo(() => getVerifyEmailMode(token), [token]);

  return (
    <AuthShell
      eyebrow="Verify Email"
      title="Activate your account"
      description="Confirm your email address so we can safely unlock workspace setup and future team access."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span>Step 2 of 3</span>
            <span>Verify email</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </div>

        {mode === 'verify' ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Your verification link is ready. Complete verification to start onboarding.
            </p>

            {verify.error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(verify.error as Error).message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => verify.mutate(token)}
              disabled={verify.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {verify.isPending ? 'Verifying…' : 'Verify email'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              We sent a verification link to your email. If it hasn’t arrived yet, resend it below.
            </p>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="you@company.io"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            {resend.error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(resend.error as Error).message}
              </div>
            ) : null}
            {resend.isSuccess ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                Verification email sent. Check your inbox.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => resend.mutate(email)}
              disabled={resend.isPending || !email.trim()}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {resend.isPending ? 'Sending…' : 'Resend verification'}
              </span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Go to sign in
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
