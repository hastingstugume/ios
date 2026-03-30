import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  organization: { create: jest.fn() },
  organizationMember: { create: jest.fn(), findFirst: jest.fn() },
  session: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
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
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('should throw ConflictException if email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.register('test@test.com', 'pass', 'Test', 'Org')).rejects.toThrow(ConflictException);
  });

  it('should throw UnauthorizedException on bad password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'wrong-hash' });
    await expect(service.login('test@test.com', 'wrongpass')).rejects.toThrow(UnauthorizedException);
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
});
