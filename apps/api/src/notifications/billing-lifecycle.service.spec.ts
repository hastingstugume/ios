import { ConfigService } from '@nestjs/config';
import { AuditAction, UserRole } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { NotificationsService } from './notifications.service';

describe('BillingLifecycleService', () => {
  const prismaMock: any = {
    organization: { findMany: jest.fn() },
    source: { count: jest.fn() },
    keyword: { count: jest.fn() },
    alertRule: { count: jest.fn() },
    organizationMember: { count: jest.fn() },
    invitation: { count: jest.fn() },
    signal: { count: jest.fn() },
    auditLog: { findMany: jest.fn(), create: jest.fn() },
  };

  const configMock: Partial<ConfigService> = {
    get: (_key: string, fallback?: any) => fallback,
  };

  const entitlementsMock: Partial<EntitlementsService> = {
    normalizePlan: (plan?: string | null) => ((plan || 'free') as any),
    getPlanEntitlements: (plan?: string | null) => {
      if (plan === 'starter') {
        return { plan: 'starter', label: 'Starter', maxSeats: 1, maxSources: 3, maxKeywords: 25, maxAlerts: 3 } as any;
      }
      return { plan: 'free', label: 'Free', maxSeats: 1, maxSources: 1, maxKeywords: 10, maxAlerts: 1 } as any;
    },
  };

  const notificationsMock: Partial<NotificationsService> = {
    sendNearLimitUpgradeEmail: jest.fn(),
    sendInactivityRecoveryEmail: jest.fn(),
  };

  let service: BillingLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingLifecycleService(
      prismaMock as PrismaService,
      configMock as ConfigService,
      entitlementsMock as EntitlementsService,
      notificationsMock as NotificationsService,
    );
  });

  it('sends a near-limit email when paid workspace usage crosses threshold', async () => {
    prismaMock.organization.findMany.mockResolvedValue([
      {
        id: 'org_1',
        name: 'Acme',
        plan: 'starter',
        members: [{ role: UserRole.OWNER, user: { email: 'owner@example.com' } }],
      },
    ]);
    prismaMock.auditLog.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          action: AuditAction.ORG_SETTINGS_UPDATED,
          metadata: { systemEvent: 'LIFECYCLE_EMAIL_SENT', template: 'inactivity_recovery' },
        },
      ]);
    prismaMock.source.count.mockResolvedValue(3);
    prismaMock.keyword.count.mockResolvedValue(10);
    prismaMock.alertRule.count.mockResolvedValue(1);
    prismaMock.organizationMember.count.mockResolvedValue(1);
    prismaMock.invitation.count.mockResolvedValue(0);

    await service.evaluateLifecycleEmails();

    expect(notificationsMock.sendNearLimitUpgradeEmail).toHaveBeenCalledWith(
      ['owner@example.com'],
      'Acme',
      'Starter',
      expect.any(Array),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          action: AuditAction.ORG_SETTINGS_UPDATED,
        }),
      }),
    );
  });

  it('sends inactivity recovery email when active pipeline has stalled', async () => {
    prismaMock.organization.findMany.mockResolvedValue([
      {
        id: 'org_1',
        name: 'Acme',
        plan: 'starter',
        members: [{ role: UserRole.ADMIN, user: { email: 'admin@example.com' } }],
      },
    ]);
    prismaMock.auditLog.findMany
      .mockResolvedValueOnce([
        {
          action: AuditAction.ORG_SETTINGS_UPDATED,
          metadata: { systemEvent: 'LIFECYCLE_EMAIL_SENT', template: 'near_limit' },
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.source.count.mockResolvedValue(1);
    prismaMock.keyword.count.mockResolvedValue(1);
    prismaMock.signal.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(0);

    await service.evaluateLifecycleEmails();

    expect(notificationsMock.sendInactivityRecoveryEmail).toHaveBeenCalledWith(
      ['admin@example.com'],
      'Acme',
      'Starter',
      7,
    );
  });
});
