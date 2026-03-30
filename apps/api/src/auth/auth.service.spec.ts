import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { generateCurrentTotpCode } from './totp.util';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  userIdentity: { findUnique: jest.fn(), create: jest.fn() },
  organization: { create: jest.fn() },
  organizationMember: { create: jest.fn(), findFirst: jest.fn() },
  session: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
  mfaChallenge: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  invitation: { findUnique: jest.fn(), update: jest.fn() },
  emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn((arg: any) => {
    if (typeof arg === 'function') return arg(mockPrisma);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, d?: any) => {
              const values: Record<string, any> = {
                GOOGLE_CLIENT_ID: 'google-client',
                GOOGLE_CLIENT_SECRET: 'google-secret',
                MICROSOFT_CLIENT_ID: 'microsoft-client',
                MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
                GITHUB_CLIENT_ID: 'github-client',
                GITHUB_CLIENT_SECRET: 'github-secret',
                API_BASE_URL: 'http://localhost:3001',
                MFA_ISSUER: 'Opportunity Scanner',
              };

              return k in values ? values[k] : d;
            },
          },
        },
        { provide: NotificationsService, useValue: { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('should throw ConflictException if email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.register('test@test.com', 'pass', 'Test')).rejects.toThrow(ConflictException);
  });

  it('creates an unverified user and verification token on register', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test' });
    mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailVerificationToken.create.mockResolvedValue({ id: 'evt_1', token: 'verify_123' });

    await expect(service.register('test@test.com', 'password-123', 'Test')).resolves.toEqual(
      expect.objectContaining({ success: true, requiresVerification: true }),
    );
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ emailVerified: false }),
    }));
  });

  it('should throw UnauthorizedException on bad password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'wrong-hash' });
    await expect(service.login('test@test.com', 'wrongpass')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for unverified password users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: await require('bcryptjs').hash('current-pass', 1),
      emailVerified: false,
    });
    await expect(service.login('test@test.com', 'current-pass')).rejects.toThrow(ForbiddenException);
  });

  it('returns auth state with the session on login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      emailVerified: true,
      onboardingCompletedAt: null,
      passwordHash: await require('bcryptjs').hash('current-pass', 1),
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      token: 'ses_123',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.login('test@test.com', 'current-pass')).resolves.toEqual(
      expect.objectContaining({
        token: 'ses_123',
        authState: {
          emailVerified: true,
          onboardingCompleted: false,
        },
      }),
    );
  });

  it('returns an MFA challenge instead of a session when MFA is enabled', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      emailVerified: true,
      onboardingCompletedAt: null,
      mfaEnabledAt: new Date(),
      mfaSecret: 'SECRET123',
      passwordHash: await require('bcryptjs').hash('current-pass', 1),
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    mockPrisma.mfaChallenge.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.mfaChallenge.create.mockResolvedValue({
      token: 'mfa_123',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.login('test@test.com', 'current-pass')).resolves.toEqual({
      mfaRequired: true,
      challengeToken: 'mfa_123',
      authState: {
        emailVerified: true,
        onboardingCompleted: false,
      },
    });
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  it('should return null for expired/invalid session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const result = await service.validateSession('bad-token');
    expect(result).toBeNull();
  });

  it('should delete expired session and return null', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      token: 'tok', expiresAt: new Date(Date.now() - 1000), user: { id: 'u1' },
    });
    const result = await service.validateSession('tok');
    expect(result).toBeNull();
    expect(mockPrisma.session.delete).toHaveBeenCalled();
  });

  it('should revoke active sessions after password change', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: await require('bcryptjs').hash('current-pass', 1),
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

    await expect(service.changePassword('u1', 'current-pass', 'new-password-123')).resolves.toEqual({ success: true });
    expect(mockPrisma.user.update).toHaveBeenCalled();
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('lists sessions and marks the current one', async () => {
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 's1',
        token: 'current',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
        expiresAt: new Date('2026-04-29T10:00:00.000Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Chrome/122',
      },
      {
        id: 's2',
        token: 'other',
        createdAt: new Date('2026-03-29T10:00:00.000Z'),
        expiresAt: new Date('2026-04-28T10:00:00.000Z'),
        ipAddress: null,
        userAgent: null,
      },
    ]);

    await expect(service.listSessions('u1', 'current')).resolves.toEqual({
      sessions: [
        expect.objectContaining({ id: 's1', isCurrent: true }),
        expect.objectContaining({ id: 's2', isCurrent: false }),
      ],
    });
  });

  it('revokes a non-current session', async () => {
    mockPrisma.session.findFirst.mockResolvedValue({
      id: 's2',
      token: 'other',
      userId: 'u1',
    });
    mockPrisma.session.delete.mockResolvedValue({ id: 's2' });

    await expect(service.revokeSession('u1', 's2', 'current')).resolves.toEqual({ success: true });
    expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 's2' } });
  });

  it('revokes other sessions while keeping the current one', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

    await expect(service.revokeOtherSessions('u1', 'current')).resolves.toEqual({ success: true });
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        token: { not: 'current' },
      },
    });
  });

  it('verifies email and creates a session', async () => {
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'evt_1',
      userId: 'u1',
      token: 'verify_123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      user: { id: 'u1' },
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    mockPrisma.emailVerificationToken.update.mockResolvedValue({ id: 'evt_1' });
    mockPrisma.session.create.mockResolvedValue({
      token: 'ses_123',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.verifyEmail('verify_123')).resolves.toEqual(
      expect.objectContaining({ token: 'ses_123' }),
    );
  });

  it('resends verification by expiring prior tokens and issuing a fresh one', async () => {
    const notifications = { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, d?: any) => {
              const values: Record<string, any> = {
                GOOGLE_CLIENT_ID: 'google-client',
                GOOGLE_CLIENT_SECRET: 'google-secret',
                MICROSOFT_CLIENT_ID: 'microsoft-client',
                MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
                GITHUB_CLIENT_ID: 'github-client',
                GITHUB_CLIENT_SECRET: 'github-secret',
                API_BASE_URL: 'http://localhost:3001',
                MFA_ISSUER: 'Opportunity Scanner',
              };

              return k in values ? values[k] : d;
            },
          },
        },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(AuthService);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      name: 'Test',
      emailVerified: false,
    });
    mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.emailVerificationToken.create.mockResolvedValue({
      id: 'evt_2',
      token: 'verify_456',
      userId: 'u1',
    });

    await expect(service.resendVerification('test@test.com')).resolves.toEqual({ success: true });
    expect(mockPrisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        token: expect.stringMatching(/^verify_/),
      }),
    });
    expect(notifications.sendVerificationEmail).toHaveBeenCalledWith('test@test.com', 'Test', 'verify_456');
  });

  it('creates a password reset token for password users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      name: 'Test',
      passwordHash: 'hash',
    });
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({ id: 'prt_1', token: 'reset_123' });

    await expect(service.requestPasswordReset('test@test.com')).resolves.toEqual({ success: true });
    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
  });

  it('links an OAuth sign-in to an existing email/password user', async () => {
    jest.spyOn<any, any>(service as any, 'exchangeOAuthCode').mockResolvedValue('oauth_token');
    jest.spyOn<any, any>(service as any, 'fetchOAuthProfile').mockResolvedValue({
      providerUserId: 'google-user-1',
      email: 'test@test.com',
      emailVerified: true,
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    });
    mockPrisma.userIdentity.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      name: null,
      avatarUrl: null,
      memberships: [],
      onboardingCompletedAt: null,
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
      memberships: [],
      onboardingCompletedAt: null,
    });
    mockPrisma.userIdentity.create.mockResolvedValue({ id: 'ident_1' });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      token: 'ses_123',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.loginWithOAuth('google', 'oauth-code')).resolves.toEqual(
      expect.objectContaining({
        token: 'ses_123',
        authState: {
          emailVerified: true,
          onboardingCompleted: false,
        },
      }),
    );
    expect(mockPrisma.userIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        provider: 'google',
        providerUserId: 'google-user-1',
      }),
    });
  });

  it('accepts an invitation during provider sign-in', async () => {
    jest.spyOn<any, any>(service as any, 'exchangeOAuthCode').mockResolvedValue('oauth_token');
    jest.spyOn<any, any>(service as any, 'fetchOAuthProfile').mockResolvedValue({
      providerUserId: 'github-user-1',
      email: 'invitee@test.com',
      emailVerified: true,
      name: 'Invitee',
      avatarUrl: null,
    });
    mockPrisma.userIdentity.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'u2',
        email: 'invitee@test.com',
        onboardingCompletedAt: null,
        memberships: [{ organizationId: 'org_1' }],
      });
    mockPrisma.user.create.mockResolvedValue({
      id: 'u2',
      email: 'invitee@test.com',
      name: 'Invitee',
      memberships: [],
      onboardingCompletedAt: null,
    });
    mockPrisma.userIdentity.create.mockResolvedValue({ id: 'ident_2' });
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'invite_1',
      organizationId: 'org_1',
      email: 'invitee@test.com',
      role: 'ANALYST',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      organization: { id: 'org_1' },
    });
    mockPrisma.organizationMember.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ organizationId: 'org_1' });
    mockPrisma.organizationMember.create.mockResolvedValue({ id: 'member_1' });
    mockPrisma.invitation.update.mockResolvedValue({ id: 'invite_1' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log_1' });
    mockPrisma.session.create.mockResolvedValue({
      token: 'ses_456',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.loginWithOAuth('github', 'oauth-code', 'invite-token')).resolves.toEqual(
      expect.objectContaining({
        token: 'ses_456',
        authState: {
          emailVerified: true,
          onboardingCompleted: false,
        },
      }),
    );
    expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u2',
        organizationId: 'org_1',
      }),
    });
    expect(mockPrisma.invitation.update).toHaveBeenCalled();
  });

  it('accepts an invitation during password registration when the email matches', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'u3',
      email: 'invitee@test.com',
      name: 'Invitee',
    });
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'invite_2',
      organizationId: 'org_2',
      email: 'invitee@test.com',
      role: 'ANALYST',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      organization: { id: 'org_2' },
    });
    mockPrisma.organizationMember.create.mockResolvedValue({ id: 'member_2' });
    mockPrisma.invitation.update.mockResolvedValue({ id: 'invite_2' });
    mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailVerificationToken.create.mockResolvedValue({ id: 'evt_3', token: 'verify_789' });

    await expect(service.register('invitee@test.com', 'password-123', 'Invitee', 'invite-token')).resolves.toEqual(
      expect.objectContaining({
        success: true,
        requiresVerification: true,
        joinedOrgId: 'org_2',
      }),
    );
    expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u3',
        organizationId: 'org_2',
        role: 'ANALYST',
      }),
    });
    expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_2' },
      data: { acceptedAt: expect.any(Date) },
    });
  });

  it('resets password and revokes sessions with a valid reset token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt_1',
      userId: 'u1',
      token: 'reset_123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      user: {
        id: 'u1',
        passwordHash: await require('bcryptjs').hash('current-pass', 1),
      },
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    mockPrisma.passwordResetToken.update.mockResolvedValue({ id: 'prt_1' });
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.resetPassword('reset_123', 'new-password-123')).resolves.toEqual({ success: true });
    expect(mockPrisma.passwordResetToken.update).toHaveBeenCalled();
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('sets up and enables MFA with a valid authenticator code', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'test@test.com',
        emailVerified: true,
      })
      .mockResolvedValueOnce({
        id: 'u1',
        mfaPendingSecret: 'JBSWY3DPEHPK3PXP',
      });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });

    const setup = await service.setupMfa('u1');
    expect(setup.secret).toBeTruthy();

    const code = generateCurrentTotpCode('JBSWY3DPEHPK3PXP');
    await expect(service.enableMfa('u1', code)).resolves.toEqual(
      expect.objectContaining({
        success: true,
        backupCodes: expect.any(Array),
      }),
    );
  });

  it('completes an MFA login challenge with a valid code', async () => {
    const code = generateCurrentTotpCode('JBSWY3DPEHPK3PXP');
    mockPrisma.mfaChallenge.findUnique.mockResolvedValue({
      id: 'challenge_1',
      token: 'mfa_123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      user: {
        id: 'u1',
        emailVerified: true,
        onboardingCompletedAt: null,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        mfaBackupCodes: [],
      },
    });
    mockPrisma.mfaChallenge.update.mockResolvedValue({ id: 'challenge_1' });
    mockPrisma.session.create.mockResolvedValue({
      token: 'ses_789',
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.verifyMfaLogin('mfa_123', code)).resolves.toEqual(
      expect.objectContaining({
        token: 'ses_789',
        authState: {
          emailVerified: true,
          onboardingCompleted: false,
        },
      }),
    );
  });

  it('completes onboarding and creates a workspace for a new user without memberships', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      emailVerified: true,
      memberships: [],
    });
    mockPrisma.organization.create.mockResolvedValue({ id: 'org_1', name: 'Acme' });
    mockPrisma.organizationMember.create.mockResolvedValue({ id: 'mem_1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log_1' });

    await expect(service.completeOnboarding('u1', 'BUSINESS' as any, 'Acme')).resolves.toEqual(
      expect.objectContaining({ success: true, organizationId: 'org_1' }),
    );
  });
});
