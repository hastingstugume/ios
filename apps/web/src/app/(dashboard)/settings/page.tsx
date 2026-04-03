'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUpgradeCheckout } from '@/hooks/useUpgradeCheckout';
import { useBillingPortal } from '@/hooks/useBillingPortal';
import { authApi, billingApi, keywordsApi, organizationsApi, type AuditLog, type AuthSession, type Invitation, type OrganizationMember } from '@/lib/api';
import { getPlanLimitUpgradeHint } from '@/lib/planLimitErrors';
import { getNextPlan, normalizeWorkspacePlan, WORKSPACE_PLAN_MAP } from '@/lib/plans';
import { useTheme, type ThemeMode } from '@/components/theme-provider';
import { formatDate, formatPlanName } from '@/lib/utils';
import { User, Building2, Shield, Users, Clock3, Link as LinkIcon, Trash2, Plus, Pencil, Sun, Moon, Monitor, CreditCard } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import QRCode from 'qrcode';
import { Switch } from '@/components/ui/switch';

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'] as const;
type SettingsTab = 'account' | 'workspace' | 'team' | 'security' | 'audit';

const SETTINGS_TABS: Array<{ key: SettingsTab; label: string; hint: string }> = [
  { key: 'account', label: 'Account', hint: 'Profile and appearance' },
  { key: 'workspace', label: 'Workspace', hint: 'Workspace, plan, and limits' },
  { key: 'team', label: 'Team', hint: 'Members and invitations' },
  { key: 'security', label: 'Security', hint: 'Password, sessions, and MFA' },
  { key: 'audit', label: 'Audit', hint: 'Workspace activity history' },
];

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {role}
    </span>
  );
}

function formatSessionLabel(userAgent: string | null) {
  if (!userAgent) return 'Browser session';

  if (/chrome/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome|chromium/i.test(userAgent)) return 'Safari';
  if (/edg/i.test(userAgent)) return 'Edge';

  return 'Browser session';
}

function formatSessionTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSessionIp(ipAddress: string | null) {
  if (!ipAddress) return null;

  if (ipAddress === '::1') {
    return '127.0.0.1';
  }

  return ipAddress;
}

function formatCurrencyCents(amount: number | null, currency: string) {
  if (amount === null || Number.isNaN(amount)) return 'N/A';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export default function SettingsPage() {
  const { user, currentOrg, currentOrgId, role } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [businessFocus, setBusinessFocus] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string; issuer: string } | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaEnableCode, setMfaEnableCode] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[] | null>(null);
  const [showDisableMfaWarning, setShowDisableMfaWarning] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'ANALYST' });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    setOrgName(currentOrg?.name || '');
  }, [currentOrg?.name]);

  useEffect(() => {
    setBusinessFocus(currentOrg?.businessFocus || '');
  }, [currentOrg?.businessFocus]);

  useEffect(() => {
    setTargetAudience(currentOrg?.targetAudience || '');
  }, [currentOrg?.targetAudience]);

  useEffect(() => {
    setNegativeKeywords((currentOrg?.negativeKeywords || []).join(', '));
  }, [currentOrg?.negativeKeywords]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncTabFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (!hash) return;
      if (hash.includes('plan-limits') || hash.includes('workspace')) {
        setActiveTab('workspace');
        return;
      }
      if (hash.includes('team')) {
        setActiveTab('team');
        return;
      }
      if (hash.includes('security') || hash.includes('password') || hash.includes('sessions') || hash.includes('mfa')) {
        setActiveTab('security');
        return;
      }
      if (hash.includes('audit')) {
        setActiveTab('audit');
      }
    };

    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function generateMfaQrCode() {
      if (!mfaSetup?.otpauthUri) {
        setMfaQrCode(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(mfaSetup.otpauthUri, {
          margin: 1,
          width: 180,
          color: {
            dark: '#E8EEF8',
            light: '#111827',
          },
        });
        if (!cancelled) setMfaQrCode(dataUrl);
      } catch {
        if (!cancelled) setMfaQrCode(null);
      }
    }

    generateMfaQrCode();
    return () => {
      cancelled = true;
    };
  }, [mfaSetup]);

  const membersQuery = useQuery({
    queryKey: ['org-members', currentOrgId],
    queryFn: () => organizationsApi.members(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const auditQuery = useQuery({
    queryKey: ['org-audit', currentOrgId],
    queryFn: () => organizationsApi.auditLog(currentOrgId!, 1, 20),
    enabled: !!currentOrgId,
  });
  const keywordsQuery = useQuery({
    queryKey: ['keywords', currentOrgId],
    queryFn: () => keywordsApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });
  const usageQuery = useQuery({
    queryKey: ['workspace-usage', currentOrgId],
    queryFn: () => organizationsApi.usage(currentOrgId!),
    enabled: !!currentOrgId,
    refetchInterval: 60_000,
  });
  const billingOverviewQuery = useQuery({
    queryKey: ['billing-overview', currentOrgId],
    queryFn: () => billingApi.overview(currentOrgId!),
    enabled: !!currentOrgId && (role === 'OWNER' || role === 'ADMIN'),
    refetchInterval: 60_000,
  });
  const sessionsQuery = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authApi.sessions(),
    enabled: !!user?.id,
  });

  const canManageWorkspace = role === 'OWNER' || role === 'ADMIN';

  const profileMutation = useMutation({
    mutationFn: () => authApi.updateMe({ name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });

  const orgMutation = useMutation({
    mutationFn: () => organizationsApi.update(currentOrgId!, {
      name: orgName.trim(),
      businessFocus: businessFocus.trim(),
      targetAudience: targetAudience.trim(),
      negativeKeywords: negativeKeywords.split(',').map((term) => term.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      qc.invalidateQueries({ queryKey: ['org-members', currentOrgId] });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword(passwords),
    onSuccess: () => setPasswords({ currentPassword: '', newPassword: '' }),
  });
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-sessions'] }),
  });
  const revokeOtherSessionsMutation = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-sessions'] }),
  });

  const setupMfaMutation = useMutation({
    mutationFn: () => authApi.setupMfa(),
    onSuccess: (result) => {
      setMfaSetup(result);
      setMfaQrCode(null);
      setMfaEnableCode('');
      setMfaBackupCodes(null);
    },
  });

  const enableMfaMutation = useMutation({
    mutationFn: () => authApi.enableMfa({ code: mfaEnableCode }),
    onSuccess: async (result) => {
      setMfaBackupCodes(result.backupCodes);
      setMfaSetup(null);
      setMfaEnableCode('');
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: () => authApi.disableMfa({ code: mfaDisableCode }),
    onSuccess: async () => {
      setShowDisableMfaWarning(false);
      setMfaDisableCode('');
      setMfaBackupCodes(null);
      setMfaSetup(null);
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => organizationsApi.inviteMember(currentOrgId!, invite),
    onSuccess: () => {
      setInvite({ email: '', role: 'ANALYST' });
      setShowInviteModal(false);
      qc.invalidateQueries({ queryKey: ['org-members', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['workspace-usage', currentOrgId] });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, nextRole }: { memberId: string; nextRole: string }) =>
      organizationsApi.updateMember(currentOrgId!, memberId, { role: nextRole }),
    onSuccess: () => {
      setEditingMember(null);
      qc.invalidateQueries({ queryKey: ['org-members', currentOrgId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => organizationsApi.removeMember(currentOrgId!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members', currentOrgId] });
      qc.invalidateQueries({ queryKey: ['workspace-usage', currentOrgId] });
    },
  });

  const invitationLinkBase = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/register?invitationToken=`;
  }, []);

  const authProviders = user?.authProviders || [];
  const providerLabel = authProviders.length
    ? authProviders
        .map((provider) => {
          switch (provider) {
            case 'google':
              return 'Google';
            case 'microsoft':
              return 'Microsoft';
            case 'github':
              return 'GitHub';
            default:
              return provider;
          }
        })
        .join(', ')
    : null;

  const copyInviteLink = async (invitation: Invitation) => {
    const fullLink = `${invitationLinkBase}${invitation.token}`;
    await navigator.clipboard.writeText(fullLink);
    setCopiedToken(invitation.id);
    window.setTimeout(() => setCopiedToken(null), 2000);
  };

  const members = membersQuery.data?.members || [];
  const invitations = membersQuery.data?.invitations || [];
  const auditLogs = auditQuery.data?.data || [];
  const activeSessions = sessionsQuery.data?.sessions || [];
  const themeOptions: Array<{ value: ThemeMode; label: string; description: string; icon: any }> = [
    { value: 'light', label: 'Light', description: 'Bright interface for daytime work.', icon: Sun },
    { value: 'dark', label: 'Dark', description: 'Low-glare theme for focused sessions.', icon: Moon },
    { value: 'system', label: 'System', description: `Currently following ${resolvedTheme} mode.`, icon: Monitor },
  ];
  const trackedKeywordCount = keywordsQuery.data?.length || 0;
  const workspaceUsage = usageQuery.data;
  const billingOverview = billingOverviewQuery.data;
  const normalizedPlan = normalizeWorkspacePlan(currentOrg?.plan);
  const currentPlanMeta = WORKSPACE_PLAN_MAP[normalizedPlan];
  const nextPlan = getNextPlan(normalizedPlan);
  const seatUsageSummary = workspaceUsage
    ? workspaceUsage.resources.seats.limit === null
      ? `${workspaceUsage.resources.seats.used} seats used`
      : `${workspaceUsage.resources.seats.used}/${workspaceUsage.resources.seats.limit} seats`
    : currentPlanMeta.maxSeats === null
      ? 'Unlimited seats'
      : `0/${currentPlanMeta.maxSeats} seats`;
  const {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError,
  } = useUpgradeCheckout(currentOrgId);
  const {
    redirectingToPortal,
    portalError,
    startBillingPortal,
    clearPortalError,
  } = useBillingPortal(currentOrgId);
  const profileChecklist = [
    Boolean((currentOrg?.businessFocus || businessFocus).trim()),
    Boolean((currentOrg?.targetAudience || targetAudience).trim()),
    trackedKeywordCount > 0,
    Boolean((currentOrg?.negativeKeywords || negativeKeywords.split(',').map((term) => term.trim()).filter(Boolean)).length),
  ];
  const completedProfileItems = profileChecklist.filter(Boolean).length;
  const teamSeatLimitReached = Boolean(workspaceUsage?.resources.seats.atLimit);
  const inviteUpgradeHint = getPlanLimitUpgradeHint(inviteMutation.error, currentOrg?.plan);

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInvite({ email: '', role: 'ANALYST' });
    inviteMutation.reset();
    clearCheckoutError();
  };

  const closeEditMemberModal = () => {
    setEditingMember(null);
    updateMemberMutation.reset();
  };

  const cancelMfaSetup = () => {
    setMfaSetup(null);
    setMfaEnableCode('');
    setMfaQrCode(null);
    setMfaBackupCodes(null);
    setupMfaMutation.reset();
    enableMfaMutation.reset();
  };

  const closeDisableMfaModal = () => {
    if (disableMfaMutation.isPending) return;
    setShowDisableMfaWarning(false);
    setMfaDisableCode('');
    disableMfaMutation.reset();
  };

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-2 text-base text-muted-foreground">Manage your account, workspace, team access, and audit visibility.</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{formatPlanName(currentOrg?.plan)}</span> plan
        </div>
      </section>

      <section className="section-card p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border bg-secondary hover:bg-accent'
                }`}
              >
                <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{tab.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tab.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`section-card ${activeTab === 'account' ? '' : 'hidden'}`}>
        <SectionTitle icon={User} title="Profile" subtitle="Update the name shown across your workspace activity." />
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
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input value={user?.email || ''} disabled className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground" />
            </div>
          </div>
          {profileMutation.error && <p className="text-sm text-destructive">{(profileMutation.error as Error).message}</p>}
          <button
            disabled={!name.trim() || name.trim() === (user?.name || '') || profileMutation.isPending}
            onClick={() => profileMutation.mutate()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {profileMutation.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </section>

      <section className={`section-card ${activeTab === 'account' ? '' : 'hidden'}`}>
        <SectionTitle icon={Sun} title="Appearance" subtitle="Choose how the app looks across this browser." />
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 md:grid-cols-3">
            {themeOptions.map(({ value, label, description, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-border bg-secondary hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg border p-2 ${active ? 'border-primary/20 bg-background text-primary' : 'border-border text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground">{label}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`section-card ${activeTab === 'workspace' ? '' : 'hidden'}`}>
        <SectionTitle icon={Building2} title="Workspace" subtitle="Keep workspace settings accurate and visible to your team." />
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Workspace name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManageWorkspace}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Your role</label>
              <div className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm capitalize text-muted-foreground">
                {role || '—'}
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Business focus</label>
              <input
                value={businessFocus}
                onChange={(e) => setBusinessFocus(e.target.value)}
                disabled={!canManageWorkspace}
                placeholder="DevOps consulting, AI automation, ERP implementation"
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:text-muted-foreground"
              />
              <p className="mt-2 text-xs text-muted-foreground">Used to tailor AI-generated source templates to your niche.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Target buyers</label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                disabled={!canManageWorkspace}
                placeholder="B2B SaaS founders, operations leaders, internal IT teams"
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:text-muted-foreground"
              />
              <p className="mt-2 text-xs text-muted-foreground">Who you want the scanner to find demand from most often.</p>
            </div>
          </div>
          <details className="rounded-xl border border-border bg-secondary">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm text-foreground">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Advanced workspace settings</span>
                <span className="text-xs text-muted-foreground">
                  Profile strength {completedProfileItems}/{profileChecklist.length}
                </span>
              </div>
            </summary>
            <div className="space-y-4 border-t border-border px-4 py-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Workspace negative keywords</label>
                <input
                  value={negativeKeywords}
                  onChange={(e) => setNegativeKeywords(e.target.value)}
                  disabled={!canManageWorkspace}
                  placeholder="wordpress, crypto, newsletter, affiliate"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:text-muted-foreground"
                />
                <p className="mt-2 text-xs text-muted-foreground">Comma-separated phrases filtered out across this workspace.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/sources/templates"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  Suggested templates
                </Link>
                <Link
                  href="/keywords"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Tracked keywords
                </Link>
              </div>
            </div>
          </details>
          <div id="plan-limits" className="rounded-xl border border-border bg-secondary p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Plan and limits
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{formatPlanName(currentOrg?.plan)}</span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">Active</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  These are your workspace limits right now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startBillingPortal({ returnPath: '/settings#plan-limits' })}
                  disabled={redirectingToPortal}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {redirectingToPortal ? 'Redirecting...' : 'Manage billing'}
                </button>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  See upgrade options
                </Link>
                {nextPlan ? (
                  <button
                    type="button"
                    onClick={() => startUpgradeCheckout(nextPlan)}
                    disabled={!!redirectingPlan}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {redirectingPlan === nextPlan ? 'Redirecting…' : `Upgrade to ${WORKSPACE_PLAN_MAP[nextPlan].label}`}
                  </button>
                ) : null}
              </div>
            </div>
            {checkoutError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <div className="flex items-center justify-between gap-3">
                  <span>{checkoutError}</span>
                  <button
                    type="button"
                    onClick={clearCheckoutError}
                    className="rounded-md border border-destructive/40 px-2 py-0.5 transition-colors hover:bg-destructive/10"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            {portalError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <div className="flex items-center justify-between gap-3">
                  <span>{portalError}</span>
                  <button
                    type="button"
                    onClick={clearPortalError}
                    className="rounded-md border border-destructive/40 px-2 py-0.5 transition-colors hover:bg-destructive/10"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            <details className="mt-4 rounded-lg border border-border bg-background">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Usage meters</span>
                  <span className="text-xs text-muted-foreground">{seatUsageSummary}</span>
                </div>
              </summary>
              <div className="grid gap-2 border-t border-border px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sources</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {workspaceUsage
                      ? workspaceUsage.resources.sources.limit === null
                        ? `${workspaceUsage.resources.sources.used} active`
                        : `${workspaceUsage.resources.sources.used}/${workspaceUsage.resources.sources.limit}`
                      : currentPlanMeta.maxSources ?? 'Unlimited'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {workspaceUsage?.resources.sources.limit === null
                      ? 'Unlimited on this plan'
                      : `${workspaceUsage?.resources.sources.remaining ?? currentPlanMeta.maxSources ?? 0} remaining`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${workspaceUsage?.resources.sources.percentUsed ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {workspaceUsage
                      ? workspaceUsage.resources.keywords.limit === null
                        ? `${workspaceUsage.resources.keywords.used} active`
                        : `${workspaceUsage.resources.keywords.used}/${workspaceUsage.resources.keywords.limit}`
                      : currentPlanMeta.maxKeywords ?? 'Unlimited'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {workspaceUsage?.resources.keywords.limit === null
                      ? 'Unlimited on this plan'
                      : `${workspaceUsage?.resources.keywords.remaining ?? currentPlanMeta.maxKeywords ?? 0} remaining`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${workspaceUsage?.resources.keywords.percentUsed ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alerts</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {workspaceUsage
                      ? workspaceUsage.resources.alerts.limit === null
                        ? `${workspaceUsage.resources.alerts.used} active`
                        : `${workspaceUsage.resources.alerts.used}/${workspaceUsage.resources.alerts.limit}`
                      : currentPlanMeta.maxAlerts ?? 'Unlimited'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {workspaceUsage?.resources.alerts.limit === null
                      ? 'Unlimited on this plan'
                      : `${workspaceUsage?.resources.alerts.remaining ?? currentPlanMeta.maxAlerts ?? 0} remaining`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${workspaceUsage?.resources.alerts.percentUsed ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seats</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {workspaceUsage
                      ? workspaceUsage.resources.seats.limit === null
                        ? `${workspaceUsage.resources.seats.used} active`
                        : `${workspaceUsage.resources.seats.used}/${workspaceUsage.resources.seats.limit}`
                      : currentPlanMeta.maxSeats ?? 'Unlimited'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {workspaceUsage?.resources.seats.limit === null
                      ? 'Unlimited on this plan'
                      : `${workspaceUsage?.resources.seats.remaining ?? currentPlanMeta.maxSeats ?? 0} remaining`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${workspaceUsage?.resources.seats.percentUsed ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </details>
            <details className="mt-4 rounded-lg border border-border bg-background">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Billing overview and invoices</span>
                  <span className="text-xs text-muted-foreground">
                    {billingOverview?.hasBillingProfile ? `${billingOverview.invoices.length} recent invoices` : 'No billing history yet'}
                  </span>
                </div>
              </summary>
              <div className="space-y-3 border-t border-border px-3 py-3">
                {billingOverviewQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading billing details...</p>
                ) : !billingOverview?.hasBillingProfile ? (
                  <p className="text-sm text-muted-foreground">
                    No billing profile yet. Start with an upgrade checkout to generate subscriptions and invoices.
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-border bg-secondary px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Subscription status</span>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {billingOverview.subscription?.status || 'Unknown'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {formatCurrencyCents(
                          billingOverview.subscription?.amount ?? null,
                          billingOverview.subscription?.currency || 'USD',
                        )}
                        {billingOverview.subscription?.interval ? ` / ${billingOverview.subscription.interval}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {billingOverview.subscription?.currentPeriodEnd
                          ? `Current period ends ${formatDate(billingOverview.subscription.currentPeriodEnd)}`
                          : 'No active renewal date'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {billingOverview.invoices.slice(0, 5).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {formatCurrencyCents(invoice.amountPaid, invoice.currency)}
                              <span className="ml-2 text-xs text-muted-foreground uppercase">{invoice.status || 'unknown'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {invoice.hostedInvoiceUrl ? (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent"
                              >
                                View invoice
                              </a>
                            ) : null}
                            {invoice.invoicePdf ? (
                              <a
                                href={invoice.invoicePdf}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                PDF
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {!billingOverview.invoices.length ? (
                        <p className="text-xs text-muted-foreground">No invoices found yet for this workspace.</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>
          {!canManageWorkspace && <p className="text-sm text-muted-foreground">Only workspace admins can update workspace settings.</p>}
          {orgMutation.error && <p className="text-sm text-destructive">{(orgMutation.error as Error).message}</p>}
          {canManageWorkspace && (
            <button
              disabled={
                (
                  (!orgName.trim() || orgName.trim() === (currentOrg?.name || ''))
                  && businessFocus.trim() === (currentOrg?.businessFocus || '')
                  && targetAudience.trim() === (currentOrg?.targetAudience || '')
                  && negativeKeywords === ((currentOrg?.negativeKeywords || []).join(', '))
                ) || orgMutation.isPending
              }
              onClick={() => orgMutation.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {orgMutation.isPending ? 'Saving…' : 'Save workspace'}
            </button>
          )}
        </div>
      </section>

      <section className={`section-card ${activeTab === 'team' ? '' : 'hidden'}`}>
        <SectionTitle icon={Users} title="Team Access" subtitle="Manage members, invite new teammates, and keep workspace roles accurate." />
        <div className="space-y-5 px-5 py-5">
          {teamSeatLimitReached ? (
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
              <p className="text-sm text-primary">
                Your team seats are fully used ({workspaceUsage?.resources.seats.used}/{workspaceUsage?.resources.seats.limit}). Upgrade to invite more teammates.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {nextPlan ? (
                  <button
                    type="button"
                    onClick={() => startUpgradeCheckout(nextPlan)}
                    disabled={!!redirectingPlan}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {redirectingPlan === nextPlan ? 'Redirecting…' : `Upgrade to ${WORKSPACE_PLAN_MAP[nextPlan].label}`}
                  </button>
                ) : (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg border border-primary/30 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
                  >
                    See plans
                  </Link>
                )}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{members.length}</span> members
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{invitations.length}</span> pending invites
            </div>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{seatUsageSummary}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Workspace members and invitations</p>
              <p className="mt-1 text-xs text-muted-foreground">Invite teammates by email and adjust roles without leaving this page.</p>
            </div>
            {canManageWorkspace && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add teammate
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-secondary/70">
            {members.map((member: OrganizationMember) => (
              <div key={member.id} className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
                    {(member.user.name || member.user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{member.user.name || 'Unnamed member'}</p>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                    <p className="text-[11px] text-muted-foreground">Joined {formatDate(member.joinedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    disabled={!canManageWorkspace || member.role === 'OWNER'}
                    onClick={() => setEditingMember(member)}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    disabled={!canManageWorkspace || member.role === 'OWNER' || member.user.id === user?.id}
                    onClick={() => removeMemberMutation.mutate(member.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!members.length ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No members found for this workspace.</p>
            ) : null}
          </div>

          {!!invitations.length && (
            <details className="overflow-hidden rounded-xl border border-border bg-secondary/70">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Pending invitations
                  </span>
                  <span className="text-xs text-muted-foreground">{invitations.length} pending</span>
                </div>
              </summary>
              <div className="divide-y divide-border border-t border-border">
                {invitations.map((invitation: Invitation) => (
                  <div key={invitation.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {invitation.role} · expires {formatDate(invitation.expiresAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => copyInviteLink(invitation)}
                      className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {copiedToken === invitation.id ? 'Copied link' : 'Copy link'}
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      <Modal
        open={showInviteModal}
        onClose={closeInviteModal}
        title="Add teammate"
        description="Send a workspace invite by email without leaving the member list."
      >
        <div className="space-y-4">
          <input
            value={invite.email}
            onChange={(e) => setInvite((current) => ({ ...current, email: e.target.value }))}
            placeholder="teammate@company.io"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={invite.role}
            onChange={(e) => setInvite((current) => ({ ...current, role: e.target.value }))}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {inviteMutation.error ? (
            inviteUpgradeHint ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
                <p>{inviteUpgradeHint.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inviteUpgradeHint.nextPlan ? (
                    <button
                      type="button"
                      onClick={() => startUpgradeCheckout(inviteUpgradeHint.nextPlan!)}
                      disabled={redirectingPlan === inviteUpgradeHint.nextPlan}
                      className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {redirectingPlan === inviteUpgradeHint.nextPlan
                        ? 'Redirecting…'
                        : `Upgrade to ${WORKSPACE_PLAN_MAP[inviteUpgradeHint.nextPlan].label}`}
                    </button>
                  ) : (
                    <Link
                      href="/pricing"
                      className="rounded-lg border border-primary/30 px-3 py-2 text-sm transition-colors hover:bg-primary/10"
                    >
                      See plans
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      inviteMutation.reset();
                      clearCheckoutError();
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">{(inviteMutation.error as Error).message}</p>
            )
          ) : null}
          {checkoutError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{checkoutError}</span>
                <button
                  type="button"
                  onClick={clearCheckoutError}
                  className="rounded-md border border-destructive/30 px-2 py-1 transition-colors hover:bg-destructive/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              disabled={!invite.email.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={closeInviteModal}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingMember}
        onClose={closeEditMemberModal}
        title="Edit member role"
        description="Adjust workspace permissions without removing the member from context."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary px-4 py-4">
            <p className="font-medium text-foreground">{editingMember?.user.name || 'Unnamed member'}</p>
            <p className="text-sm text-muted-foreground mt-1">{editingMember?.user.email}</p>
          </div>
          <select
            value={editingMember?.role || 'ANALYST'}
            onChange={(e) => editingMember && setEditingMember({ ...editingMember, role: e.target.value })}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {updateMemberMutation.error && <p className="text-sm text-destructive">{(updateMemberMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <button
              disabled={!editingMember || updateMemberMutation.isPending}
              onClick={() => editingMember && updateMemberMutation.mutate({ memberId: editingMember.id, nextRole: editingMember.role })}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {updateMemberMutation.isPending ? 'Saving…' : 'Save role'}
            </button>
            <button
              onClick={closeEditMemberModal}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <section className={`section-card ${activeTab === 'security' ? '' : 'hidden'}`}>
        <SectionTitle icon={Shield} title="Password" subtitle="Change your password with current-password verification." />
        <div className="space-y-4 px-5 py-5">
          {user?.hasPassword ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Current password</label>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((current) => ({ ...current, currentPassword: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">New password</label>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords((current) => ({ ...current, newPassword: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              {passwordMutation.error && <p className="text-sm text-destructive">{(passwordMutation.error as Error).message}</p>}
              <button
                disabled={!passwords.currentPassword || !passwords.newPassword || passwordMutation.isPending}
                onClick={() => passwordMutation.mutate()}
                className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {passwordMutation.isPending ? 'Updating…' : 'Update password'}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-secondary px-4 py-4">
              <p className="text-sm font-medium text-foreground">This account signs in with {providerLabel || 'an external provider'}.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                There is no local password to change here. Manage your password in {providerLabel || 'your identity provider'}.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className={`section-card ${activeTab === 'security' ? '' : 'hidden'}`}>
        <SectionTitle icon={Shield} title="Sessions" subtitle="Review where your account is signed in and revoke devices you no longer use." />
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Active sessions</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This helps you spot older browsers or devices and sign them out without affecting the session you’re using now.
              </p>
            </div>
            <button
              type="button"
              onClick={() => revokeOtherSessionsMutation.mutate()}
              disabled={revokeOtherSessionsMutation.isPending || activeSessions.filter((session) => !session.isCurrent).length === 0}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {revokeOtherSessionsMutation.isPending ? 'Signing out others…' : 'Sign out other sessions'}
            </button>
          </div>

          {sessionsQuery.error ? (
            <p className="text-sm text-destructive">{(sessionsQuery.error as Error).message}</p>
          ) : null}

          <div className="space-y-3">
            {activeSessions.map((session: AuthSession) => (
              <div key={session.id} className="rounded-xl border border-border bg-secondary px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {formatSessionLabel(session.userAgent)}
                      </p>
                      {session.isCurrent ? (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Started {formatSessionTimestamp(session.createdAt)} · Expires {formatSessionTimestamp(session.expiresAt)}
                    </p>
                    {formatSessionIp(session.ipAddress) ? (
                      <p className="mt-1 text-xs text-muted-foreground">IP {formatSessionIp(session.ipAddress)}</p>
                    ) : null}
                  </div>

                  {!session.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                      className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {revokeSessionMutation.isPending ? 'Revoking…' : 'Sign out'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!activeSessions.length && !sessionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">No active sessions found.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`section-card ${activeTab === 'security' ? '' : 'hidden'}`}>
        <SectionTitle icon={Shield} title="Multi-factor authentication" subtitle="Recommended for stronger account protection, but optional for individual users." />
        <div className="space-y-4 px-5 py-5">
          {user?.hasPassword ? (
            <>
              <div className="rounded-xl border border-border bg-secondary px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Authenticator app protection</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {user?.mfaEnabled
                        ? 'Your password sign-in is currently protected by an authenticator app or backup code.'
                        : 'Keep sign-in simple or turn this on for stronger account protection.'}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(user?.mfaEnabled)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        if (!user?.mfaEnabled) setupMfaMutation.mutate();
                        return;
                      }

                      if (user?.mfaEnabled) {
                        disableMfaMutation.reset();
                        setShowDisableMfaWarning(true);
                        return;
                      }

                      cancelMfaSetup();
                    }}
                    aria-label="Toggle multi-factor authentication"
                  />
                </div>
              </div>

              {!user?.mfaEnabled && mfaSetup ? (
                <div className="space-y-4 rounded-xl border border-border bg-secondary px-4 py-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">1. Add this account to your authenticator app</p>
                    <p className="text-sm text-muted-foreground">
                      Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another compatible app.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[200px_1fr] lg:items-center">
                    <div className="flex justify-center">
                      <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
                        {mfaQrCode ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mfaQrCode} alt="Authenticator app QR code" className="h-[180px] w-[180px] rounded-lg" />
                        ) : (
                          <div className="flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-secondary text-sm text-muted-foreground">
                            Preparing QR code…
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Can’t scan? Enter this key manually</label>
                        <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground break-all">
                          {mfaSetup.secret}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(mfaSetup.secret)}
                          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                        >
                          Copy secret key
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(mfaSetup.otpauthUri)}
                          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                        >
                          Copy setup link
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">2. Enter the 6-digit code from your app</label>
                    <input
                      value={mfaEnableCode}
                      onChange={(event) => setMfaEnableCode(event.target.value)}
                      placeholder="123456"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {setupMfaMutation.error && <p className="text-sm text-destructive">{(setupMfaMutation.error as Error).message}</p>}
                  {enableMfaMutation.error && <p className="text-sm text-destructive">{(enableMfaMutation.error as Error).message}</p>}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => enableMfaMutation.mutate()}
                      disabled={!mfaEnableCode.trim() || enableMfaMutation.isPending}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {enableMfaMutation.isPending ? 'Enabling…' : 'Enable MFA'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelMfaSetup}
                      className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {user?.mfaEnabled ? (
                <div className="space-y-4 rounded-xl border border-border bg-secondary px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Recovery and disable controls</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      If you ever need to switch this off, you’ll be asked to confirm with a current authenticator code or one of your backup codes.
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
                    <p className="text-sm text-amber-700 dark:text-amber-200">
                      Turning MFA off removes the extra protection on password sign-in. Only do this if you still have another safe way to protect the account.
                    </p>
                  </div>
                </div>
              ) : null}

              {mfaBackupCodes?.length ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">Save these backup codes now</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each code works once. Store them somewhere safe before leaving this page.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {mfaBackupCodes.map((code) => (
                      <div key={code} className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-border bg-secondary px-4 py-4">
              <p className="text-sm font-medium text-foreground">This account signs in with {providerLabel || 'an external provider'}.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                We rely on {providerLabel || 'your identity provider'} for MFA and account security by default. You can continue using this account without app-level MFA unless your workspace later requires stricter controls.
              </p>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={showDisableMfaWarning}
        onClose={closeDisableMfaModal}
        title="Disable multi-factor authentication?"
        size="compact"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-200">
              Disabling MFA means your account will go back to password-only sign-in. Make sure this is intentional before you continue.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Authentication or backup code</label>
            <input
              value={mfaDisableCode}
              onChange={(event) => setMfaDisableCode(event.target.value)}
              placeholder="123456 or ABCD-EF12"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {disableMfaMutation.error ? (
            <p className="text-sm text-destructive">{(disableMfaMutation.error as Error).message}</p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeDisableMfaModal}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => disableMfaMutation.mutate()}
              disabled={!mfaDisableCode.trim() || disableMfaMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {disableMfaMutation.isPending ? 'Disabling…' : 'Disable MFA'}
            </button>
          </div>
        </div>
      </Modal>

      <section className={`section-card ${activeTab === 'audit' ? '' : 'hidden'}`}>
        <SectionTitle icon={Clock3} title="Audit Log" subtitle="Review important workspace actions and administrative changes." />
        <div className="space-y-3 px-5 py-5">
          {auditLogs.map((entry: AuditLog) => (
            <div key={entry.id} className="rounded-xl border border-border bg-secondary px-4 py-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.action.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.user?.name || entry.user?.email || 'System'} · {formatDate(entry.createdAt)}
                  </p>
                </div>
                {entry.metadata && (
                  <p className="text-xs text-muted-foreground max-w-md break-words">
                    {Object.entries(entry.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ))}
          {!auditLogs.length && <p className="text-sm text-muted-foreground">No audit activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
