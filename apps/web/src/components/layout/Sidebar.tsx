'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatPlanName } from '@/lib/utils';
import { getNextPlan, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { Radar, LayoutDashboard, Zap, Tag, Database, Bell, Settings, LogOut, ChevronDown, Building2, Check, Loader2, CreditCard, LifeBuoy, ArrowUpCircle, Target } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Target, badge: 'live' },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/sources', label: 'Data Sources', icon: Database },
  { href: '/keywords', label: 'Intent Rules', icon: Tag },
];

export function Sidebar({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, currentOrg, memberships, setCurrentOrgId, logout, isLoggingOut } = useAuth();
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const currentPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const nextPlan = getNextPlan(currentPlan);
  const nextPlanLabel = nextPlan ? WORKSPACE_PLAN_MAP[nextPlan].label : null;

  useEffect(() => {
    setShowUserMenu(false);
    setShowOrgMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleOutside = (event: MouseEvent) => {
      if (!footerRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showUserMenu]);

  return (
    <aside className={cn('w-56 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0', className)}>
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Radar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Opportunity</p>
            <p className="text-sm font-semibold text-foreground leading-tight">Scanner</p>
          </div>
        </div>
      </div>

      {currentOrg && (
        <div className="px-3 py-2.5 border-b border-border relative">
          <button
            onClick={() => setShowOrgMenu((v) => !v)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
          >
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-3 h-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <span className="block text-xs font-medium text-foreground truncate">{currentOrg.name}</span>
              <span className="block text-[10px] text-muted-foreground truncate">{formatPlanName(currentOrg.plan)} workspace</span>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
          {showOrgMenu && (
            <div className="mt-2 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
              {memberships.map((membership) => {
                const active = membership.organization.id === currentOrg.id;
                return (
                  <button
                    key={membership.id}
                    onClick={() => {
                      setCurrentOrgId(membership.organization.id);
                      setShowOrgMenu(false);
                      onNavigate?.();
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{membership.organization.name}</p>
                      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {membership.role} · {formatPlanName(membership.organization.plan)}
                      </p>
                    </div>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate?.()}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors group relative',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="flex-1">{label}</span>
              {badge === 'live' && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </span>
              )}
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
            </Link>
          );
        })}
      </nav>

      <div ref={footerRef} className="relative px-3 py-3 border-t border-border">
        {showUserMenu ? (
          <div className="absolute bottom-full left-0 right-0 z-50 mb-3">
            <div className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 border-b border-r border-border/80 bg-popover/95" />
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-popover/95 ring-1 ring-primary/20 shadow-[0_22px_56px_rgba(2,8,23,0.55)] backdrop-blur-md">
              <div className="border-b border-border px-3 py-2.5">
                <p className="truncate text-xs text-muted-foreground">{user?.email || 'Signed in'}</p>
              </div>
              <div className="p-1.5">
                <Link
                  href="/settings"
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_BILLING_CONTACT_EMAIL || 'support@opportunity-scanner.io'}?subject=${encodeURIComponent('Help with Opportunity Scanner')}`}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Get help
                </a>
              </div>
              <div className="border-t border-border p-1.5">
                <Link
                  href="/pricing"
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  {nextPlanLabel ? <ArrowUpCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  {nextPlanLabel ? `Upgrade to ${nextPlanLabel}` : 'Plans and billing'}
                </Link>
              </div>
              <div className="border-t border-border p-1.5">
                <button
                  onClick={() => {
                    if (isLoggingOut) return;
                    setShowUserMenu(false);
                    onNavigate?.();
                    logout();
                  }}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {isLoggingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <button
          onClick={() => setShowUserMenu((value) => !value)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:bg-accent"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-foreground truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {currentOrg ? `${formatPlanName(currentOrg.plan)} plan` : 'No workspace'}
            </p>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', showUserMenu && 'rotate-180')} />
        </button>
      </div>
    </aside>
  );
}
