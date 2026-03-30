'use client';
import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { getRegisterPageCopy } from '@/lib/auth-page-helpers';
import { ArrowRight, Link2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { OAuthButtons } from '@/components/auth/OAuthButtons';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
});

type FormData = z.infer<typeof schema>;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitationToken') || undefined;
  const copy = getRegisterPageCopy(invitationToken);
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const signup = useMutation({
    mutationFn: (data: FormData) => authApi.register({
      ...data,
      invitationToken,
    }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push(`/verify-email?email=${encodeURIComponent(variables.email)}`);
    },
  });

  const fields = useMemo(() => {
    const base = [
      { id: 'name', label: 'Your name', placeholder: 'Alice Thornton', type: 'text' },
      { id: 'email', label: 'Work email', placeholder: 'alice@company.io', type: 'email' },
      { id: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ] as const;

    if (invitationToken) return base;

    return [
      base[0],
      base[1],
      base[2],
    ] as const;
  }, [invitationToken]);

  return (
    <AuthShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span>Step 1 of 3</span>
            <span>Create account</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 rounded-full bg-primary" />
          </div>
        </div>

        {copy.showInvitationNotice && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
            <Link2 className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-primary/80">
              This invite link will add your account to an existing workspace after registration.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <OAuthButtons invitationToken={invitationToken} />
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

        <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="space-y-3">
          {fields.map(({ id, label, placeholder, type }) => (
            <div key={id}>
              <label className="text-sm text-muted-foreground mb-1.5 block">{label}</label>
              <input
                {...register(id)}
                type={type}
                placeholder={placeholder}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
              {errors[id] && <p className="text-destructive text-xs mt-1">{errors[id]?.message}</p>}
            </div>
          ))}

          {signup.error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <p className="text-destructive text-sm">{(signup.error as Error).message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={signup.isPending}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {signup.isPending ? 'Creating…' : (<>{copy.submitLabel} <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
