import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  organization: { findUnique: jest.fn() },
  organizationMember: { count: jest.fn() },
  invitation: { count: jest.fn() },
  source: { count: jest.fn() },
  keyword: { count: jest.fn() },
  alertRule: { count: jest.fn() },
};

describe('EntitlementsService', () => {
  let service: EntitlementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EntitlementsService(mockPrisma as PrismaService);
  });

  it('maps legacy pro plans to growth entitlements', () => {
    expect(service.getPlanEntitlements('pro')).toEqual(
      expect.objectContaining({ plan: 'growth', label: 'Growth', maxSeats: 5, maxSources: 15 }),
    );
  });

  it('rejects adding a teammate when seats are exhausted by members and pending invites', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'starter' });
    mockPrisma.organizationMember.count.mockResolvedValue(1);
    mockPrisma.invitation.count.mockResolvedValue(0);

    await expect(service.assertCanAddSeat('org_1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects keyword creation when the plan limit is reached', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'free' });
    mockPrisma.keyword.count.mockResolvedValue(10);

    await expect(service.assertCanCreateKeyword('org_1')).rejects.toThrow(ForbiddenException);
  });

  it('allows unlimited resources on scale plan', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'scale' });

    await expect(service.assertCanCreateSource('org_1')).resolves.toEqual(
      expect.objectContaining({ plan: 'scale' }),
    );
  });

  it('throws when the workspace does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(service.getWorkspaceEntitlements('missing')).rejects.toThrow(NotFoundException);
  });
});
