'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { ArrowRight, Eye, EyeOff, Mail, RefreshCw } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { OAuthButtons } from '@/components/auth/OAuthButtons';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const email = watch('email');

  const login = useMutation({
    mutationFn: (d: FormData) => authApi.login(d.email, d.password),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });

      if (!result.authState.emailVerified) {
        router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      if (!result.authState.onboardingCompleted) {
        router.replace('/onboarding');
        return;
      }

      router.replace('/dashboard');
    },
  });

  const resendVerification = useMutation({
    mutationFn: (targetEmail: string) => authApi.resendVerification(targetEmail),
  });

  const loginError = login.error ? (login.error as Error).message : null;
  const needsVerification = Boolean(loginError && loginError.toLowerCase().includes('verify your email'));

  return (
    <AuthShell
      eyebrow="Sign In"
      title="Welcome back"
      description="Sign in to review signals, alerts, and team activity."
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-primary/80">
            Demo access: <span className="font-mono">alice@acmegrowth.io</span> / <span className="font-mono">demo1234!</span>
          </p>
        </div>

        <div className="space-y-3">
          <OAuthButtons />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@company.io"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground block">Password</label>
              <Link href="/reset-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <p className="text-destructive text-sm">{loginError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {login.isPending ? 'Signing in…' : (<>Sign in <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>

        {needsVerification && email ? (
          <div className="rounded-2xl border border-border bg-secondary/55 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Finish verifying your email</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We can resend the verification link to <span className="font-medium text-foreground">{email}</span>,
                    or you can continue on the verification screen.
                  </p>
                </div>

                {resendVerification.isSuccess ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                    Verification email sent. Check your inbox and spam folder.
                  </div>
                ) : null}
                {resendVerification.error ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {(resendVerification.error as Error).message}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => resendVerification.mutate(email)}
                    disabled={resendVerification.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {resendVerification.isPending ? 'Sending…' : 'Resend verification'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/verify-email?email=${encodeURIComponent(email)}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Open verification page
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="text-primary hover:underline">Create one and verify your email</Link>
        </p>
      </div>
    </AuthShell>
  );
}
