'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, Radar } from 'lucide-react';

type AuthShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function AuthShell({
  title,
  description,
  eyebrow,
  children,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,hsl(217_91%_60%/0.08),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(222_47%_7%)_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[42rem] items-center justify-center px-5 py-8 sm:px-6 lg:px-8">
        <div className="w-full space-y-6 sm:space-y-7">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <Radar className="h-5 w-5 text-primary" />
              </div>
              <div className="leading-tight text-left">
                <p className="text-sm font-semibold text-foreground">Opportunity Scanner</p>
                <p className="text-xs text-muted-foreground">Intent signals for agencies and consultancies</p>
              </div>
            </div>
            <p className="mx-auto max-w-[34rem] text-sm leading-6 text-muted-foreground">
              Find live buying conversations, qualify urgency, and move faster than static lead lists.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[640px] rounded-[28px] border border-white/8 bg-card/95 p-6 shadow-[0_24px_80px_rgba(1,8,20,0.28)] sm:p-8">
            <div className="mb-6 space-y-3 text-center sm:mb-8">
              {eyebrow ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/80">
                  {eyebrow}
                </p>
              ) : null}
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
                <p className="mx-auto max-w-[40ch] text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
