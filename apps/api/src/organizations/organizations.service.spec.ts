import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const mockPrisma: any = {
  source: { count: jest.fn() },
  keyword: { count: jest.fn() },
  alertRule: { count: jest.fn() },
  organizationMember: { count: jest.fn() },
  invitation: { count: jest.fn() },
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: { sendWorkspaceAccessGrantedEmail: jest.fn(), sendWorkspaceInvitationEmail: jest.fn() } },
        {
          provide: EntitlementsService,
          useValue: {
            getWorkspaceEntitlements: jest.fn().mockResolvedValue({
              plan: 'free',
              label: 'Free',
              maxSeats: 1,
              maxSources: 1,
              maxKeywords: 10,
              maxAlerts: 1,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(OrganizationsService);
  });

  it('returns workspace usage totals and limits for conversion messaging', async () => {
    mockPrisma.source.count.mockResolvedValue(1);
    mockPrisma.keyword.count.mockResolvedValue(8);
    mockPrisma.alertRule.count.mockResolvedValue(1);
    mockPrisma.organizationMember.count.mockResolvedValue(1);
    mockPrisma.invitation.count.mockResolvedValue(0);

    await expect(service.getUsage('org_1')).resolves.toEqual({
      plan: 'free',
      planLabel: 'Free',
      resources: {
        sources: { used: 1, limit: 1, remaining: 0, percentUsed: 100, atLimit: true },
        keywords: { used: 8, limit: 10, remaining: 2, percentUsed: 80, atLimit: false },
        alerts: { used: 1, limit: 1, remaining: 0, percentUsed: 100, atLimit: true },
        seats: { used: 1, limit: 1, remaining: 0, percentUsed: 100, atLimit: true },
      },
    });
  });
});
