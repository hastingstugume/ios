'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatPlanName } from '@/lib/utils';
import { Radar, LayoutDashboard, Zap, Tag, Database, Bell, Settings, LogOut, ChevronDown, Building2, Check } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/feed', label: 'Opportunity Feed', icon: Zap, badge: 'live' },
  { href: '/keywords', label: 'Keywords', icon: Tag },
  { href: '/sources', label: 'Sources', icon: Database },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, currentOrg, memberships, setCurrentOrgId, logout } = useAuth();
  const [showOrgMenu, setShowOrgMenu] = useState(false);

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0">
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

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout(undefined)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
