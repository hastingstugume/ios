'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authApi, organizationsApi, type AuditLog, type Invitation, type OrganizationMember } from '@/lib/api';
import { useTheme, type ThemeMode } from '@/components/theme-provider';
import { formatDate, formatPlanName } from '@/lib/utils';
import { User, Building2, Shield, Users, Clock3, Link as LinkIcon, Trash2, Plus, Pencil, Sun, Moon, Monitor } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import QRCode from 'qrcode';
import { Switch } from '@/components/ui/switch';

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'] as const;

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

export default function SettingsPage() {
  const { user, currentOrg, currentOrgId, role } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
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
    setNegativeKeywords((currentOrg?.negativeKeywords || []).join(', '));
  }, [currentOrg?.negativeKeywords]);

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

  const canManageWorkspace = role === 'OWNER' || role === 'ADMIN';

  const profileMutation = useMutation({
    mutationFn: () => authApi.updateMe({ name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });

  const orgMutation = useMutation({
    mutationFn: () => organizationsApi.update(currentOrgId!, {
      name: orgName.trim(),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members', currentOrgId] }),
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
  const themeOptions: Array<{ value: ThemeMode; label: string; description: string; icon: any }> = [
    { value: 'light', label: 'Light', description: 'Bright interface for daytime work.', icon: Sun },
    { value: 'dark', label: 'Dark', description: 'Low-glare theme for focused sessions.', icon: Moon },
    { value: 'system', label: 'System', description: `Currently following ${resolvedTheme} mode.`, icon: Monitor },
  ];

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

      <section className="section-card">
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

      <section className="section-card">
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

      <section className="section-card">
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
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Workspace negative keywords</label>
            <input
              value={negativeKeywords}
              onChange={(e) => setNegativeKeywords(e.target.value)}
              disabled={!canManageWorkspace}
              placeholder="wordpress, crypto, newsletter, affiliate"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:text-muted-foreground"
            />
            <p className="mt-2 text-xs text-muted-foreground">Comma-separated phrases that should be filtered out across all discovery sources in this workspace.</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary p-4">
            <label className="mb-2 block text-xs text-muted-foreground">Plan</label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">{formatPlanName(currentOrg?.plan)}</span>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">Active</span>
            </div>
          </div>
          {!canManageWorkspace && <p className="text-sm text-muted-foreground">Only workspace admins can update workspace settings.</p>}
          {orgMutation.error && <p className="text-sm text-destructive">{(orgMutation.error as Error).message}</p>}
          {canManageWorkspace && (
            <button
              disabled={
                (
                  (!orgName.trim() || orgName.trim() === (currentOrg?.name || ''))
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

      <section className="section-card">
        <SectionTitle icon={Users} title="Team Access" subtitle="Manage members, invite new teammates, and keep workspace roles accurate." />
        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Workspace members and invitations</p>
              <p className="text-sm text-muted-foreground mt-1">Invite teammates by email and adjust roles without leaving the member list.</p>
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

          <div className="grid gap-3">
            {members.map((member: OrganizationMember) => (
              <div key={member.id} className="rounded-xl border border-border bg-secondary px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{member.user.name || 'Unnamed member'}</p>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{member.user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Joined {formatDate(member.joinedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
              </div>
            ))}
            {!members.length && <p className="text-sm text-muted-foreground">No members found for this workspace.</p>}
          </div>

          {!!invitations.length && (
            <div className="rounded-xl border border-border bg-secondary/70 p-4">
              <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Pending invitations</h3>
              </div>
              <div className="space-y-3">
                {invitations.map((invitation: Invitation) => (
                  <div key={invitation.id} className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-foreground">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {invitation.role} · invite email sent · expires {formatDate(invitation.expiresAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => copyInviteLink(invitation)}
                        className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {copiedToken === invitation.id ? 'Copied link' : 'Copy fallback link'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInvite({ email: '', role: 'ANALYST' }); }}
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
          {inviteMutation.error && <p className="text-sm text-destructive">{(inviteMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <button
              disabled={!invite.email.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={() => { setShowInviteModal(false); setInvite({ email: '', role: 'ANALYST' }); }}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingMember}
        onClose={() => setEditingMember(null)}
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
              onClick={() => setEditingMember(null)}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <section className="section-card">
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

      <section className="section-card">
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
                        setShowDisableMfaWarning(true);
                        return;
                      }

                      setMfaSetup(null);
                      setMfaEnableCode('');
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
                      onClick={() => {
                        setMfaSetup(null);
                        setMfaEnableCode('');
                      }}
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
        onClose={() => {
          if (disableMfaMutation.isPending) return;
          setShowDisableMfaWarning(false);
          setMfaDisableCode('');
        }}
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
              onClick={() => {
                setShowDisableMfaWarning(false);
                setMfaDisableCode('');
              }}
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

      <section className="section-card">
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
