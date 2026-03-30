'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { ArrowRight, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  const requestReset = useMutation({
    mutationFn: (targetEmail: string) => authApi.requestPasswordReset(targetEmail),
  });

  const resetPassword = useMutation({
    mutationFn: () => authApi.resetPassword({ token, newPassword }),
    onSuccess: () => {
      window.setTimeout(() => router.replace('/login'), 1200);
    },
  });

  return (
    <AuthShell
      eyebrow="Password Reset"
      title={hasToken ? 'Set a new password' : 'Reset your password'}
      description={
        hasToken
          ? 'Choose a new password for your account.'
          : 'Enter your email and we’ll send you a secure reset link.'
      }
    >
      <div className="space-y-4">
        {hasToken ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Set a new password with at least 8 characters. Once updated, any existing sessions will be signed out.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            {resetPassword.error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(resetPassword.error as Error).message}
              </div>
            ) : null}
            {resetPassword.isSuccess ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                Password updated. Redirecting you to sign in…
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending || newPassword.trim().length < 8}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {resetPassword.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
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

            {requestReset.error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(requestReset.error as Error).message}
              </div>
            ) : null}
            {requestReset.isSuccess ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                Check your inbox for the link to reset your password.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => requestReset.mutate(email)}
              disabled={requestReset.isPending || !email.trim()}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {requestReset.isPending ? 'Sending…' : 'Send reset link'}
              </span>
            </button>
          </div>
        )}

        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          Back to sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
