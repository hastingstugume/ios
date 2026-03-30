'use client';
import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { Radar, ArrowRight, Link2, ChevronLeft } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  organizationName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitationToken') || undefined;
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const organizationName = watch('organizationName');

  const signup = useMutation({
    mutationFn: (data: FormData) => authApi.register({
      ...data,
      organizationName: invitationToken ? undefined : data.organizationName,
      invitationToken,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); router.push('/dashboard'); },
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
      { id: 'organizationName', label: 'Organization name', placeholder: 'Acme Growth Agency', type: 'text' },
      base[1],
      base[2],
    ] as const;
  }, [invitationToken]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(217_91%_60%/0.08)_0%,transparent_60%)] pointer-events-none" />
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Radar className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">{invitationToken ? 'Join your workspace' : 'Create your workspace'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {invitationToken ? 'Complete your account to accept the workspace invitation' : 'Start discovering opportunities today'}
          </p>
        </div>

        {invitationToken && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
            <Link2 className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-primary/80">
              This invite link will add your account to an existing workspace after registration.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="space-y-4">
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
            disabled={signup.isPending || (!invitationToken && !organizationName?.trim())}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {signup.isPending ? 'Creating…' : (<>{invitationToken ? 'Join workspace' : 'Get started'} <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
