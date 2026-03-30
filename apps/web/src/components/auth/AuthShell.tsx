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
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-6 py-8 sm:px-8 lg:px-10">
        <div className="w-full space-y-8 lg:space-y-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to home
            </Link>

            <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 lg:mx-0">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <Radar className="h-5 w-5 text-primary" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">
                  Opportunity Scanner
                </p>
                <p className="text-xs text-muted-foreground">
                  Intent signals for agencies and consultancies
                </p>
              </div>
            </div>

            <div className="hidden lg:block w-[148px]" />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[480px_460px] lg:justify-center lg:items-center lg:gap-6 xl:grid-cols-[520px_480px] xl:gap-8">
            <section className="order-2 lg:order-1 lg:self-center">
              <div className="mx-auto max-w-[520px] text-center lg:mx-0 lg:text-left">
                <div className="space-y-4 sm:space-y-5">
                  <span className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary/80 sm:text-[11px] sm:tracking-[0.22em]">
                    Public-web buying intent
                  </span>
                  <h1 className="mx-auto max-w-[14ch] text-[2.2rem] font-semibold leading-[0.98] tracking-tight text-foreground sm:max-w-[12ch] sm:text-[3.5rem] lg:mx-0">
                    Spot buyers while they are still asking for help.
                  </h1>
                  <p className="mx-auto max-w-[34ch] text-sm leading-7 text-muted-foreground sm:max-w-[44ch] sm:text-base lg:mx-0">
                    Monitor live conversations, qualify urgency, and move the
                    strongest opportunities into a workflow before they
                    disappear into the noise.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground sm:mt-6 sm:gap-2.5 sm:text-sm lg:justify-start">
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
                    Reddit
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
                    RSS
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
                    Stack Overflow
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
                    GitHub
                  </span>
                </div>
              </div>
            </section>

            <main className="order-1 flex items-start justify-center lg:order-2 lg:justify-end">
              <div className="w-full max-w-[480px] rounded-[28px] border border-white/8 bg-card/95 p-6 shadow-[0_24px_80px_rgba(1,8,20,0.28)] sm:p-8">
                <div className="mb-6 space-y-3 sm:mb-8">
                  {eyebrow ? (
                    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/80">
                      {eyebrow}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h2>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>

                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
