'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Radar, LayoutDashboard, Zap, Tag, Database,
  Bell, Settings, LogOut, ChevronDown, Building2
} from 'lucide-react';

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
  const { user, currentOrg, logout } = useAuth();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Radar className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground leading-tight">
            Opportunity<br />Scanner
          </span>
        </div>
      </div>

      {/* Org selector */}
      {currentOrg && (
        <div className="px-3 py-2.5 border-b border-border">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors group">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground truncate flex-1 text-left">{currentOrg.name}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {/* Nav */}
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
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
                </span>
              )}
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
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
