'use client';
import { useAuth } from '@/hooks/useAuth';
import { Settings, User, Building2, CreditCard, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user, currentOrg, role } = useAuth();

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and workspace</p>
      </div>

      {/* Profile */}
      <section className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.name || '—'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Full name</label>
              <input defaultValue={user?.name || ''} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input defaultValue={user?.email || ''} disabled className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground" />
            </div>
          </div>
          <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            Save changes
          </button>
        </div>
      </section>

      {/* Organization */}
      <section className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Organization</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Organization name</label>
              <input defaultValue={currentOrg?.name || ''} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Your role</label>
              <input value={role || '—'} disabled className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground capitalize" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground capitalize">{currentOrg?.plan || 'Free'}</span>
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase font-semibold">Current</span>
            </div>
          </div>
        </div>
      </section>

      {/* Billing placeholder */}
      <section className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Billing</h2>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Billing integration coming soon.</p>
          <button className="mt-3 text-sm text-primary hover:underline">Upgrade to Pro →</button>
        </div>
      </section>

      {/* Security */}
      <section className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New password</label>
            <input type="password" placeholder="••••••••" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <button className="text-sm bg-secondary border border-border text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors">
            Update password
          </button>
        </div>
      </section>
    </div>
  );
}
