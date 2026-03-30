import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  organization: { create: jest.fn() },
  organizationMember: { create: jest.fn(), findFirst: jest.fn() },
  session: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
  invitation: { findUnique: jest.fn(), update: jest.fn() },
  emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: (k: string, d?: any) => d } },
        { provide: NotificationsService, useValue: { sendVerificationEmail: jest.fn() } },
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
