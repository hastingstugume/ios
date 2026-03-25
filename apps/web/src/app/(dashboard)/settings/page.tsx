'use client';
import { useAuth } from '@/hooks/useAuth';
import { User, Building2, CreditCard, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user, currentOrg, role } = useAuth();

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-2 text-base text-muted-foreground">Manage your account and workspace.</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground capitalize">{currentOrg?.plan || 'Free'}</span> plan
        </div>
      </section>

      <section className="section-card divide-y divide-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <User className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Profile</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-xl font-bold text-primary">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{user?.name || '—'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Full name</label>
              <input defaultValue={user?.name || ''} className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input defaultValue={user?.email || ''} disabled className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground" />
            </div>
          </div>
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90">
            Save changes
          </button>
        </div>
      </section>

      <section className="section-card divide-y divide-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Organization</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Organization name</label>
              <input defaultValue={currentOrg?.name || ''} className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Your role</label>
              <input value={role || '—'} disabled className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm capitalize text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-secondary p-4">
            <label className="mb-2 block text-xs text-muted-foreground">Plan</label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground capitalize">{currentOrg?.plan || 'Free'}</span>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">Current</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card divide-y divide-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Billing</h2>
        </div>
        <div className="px-5 py-6">
          <div className="rounded-xl border border-border bg-secondary p-5">
            <p className="text-sm text-muted-foreground">Billing integration coming soon.</p>
            <button className="mt-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/20">Upgrade to Pro</button>
          </div>
        </div>
      </section>

      <section className="section-card divide-y divide-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Security</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">New password</label>
            <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent">
            Update password
          </button>
        </div>
      </section>
    </div>
  );
}
