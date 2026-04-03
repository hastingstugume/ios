import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  organization: { findUnique: jest.fn() },
};

const mockConfig: Partial<ConfigService> = {
  get: (key: string, fallback?: any) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
    return fallback;
  },
};

describe('BillingService', () => {
  let service: BillingService;
  let stripeMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(mockPrisma as PrismaService, mockConfig as ConfigService);

    stripeMock = {
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        search: jest.fn(),
        list: jest.fn(),
      },
      customers: {
        list: jest.fn(),
      },
    };

    (service as any).stripeClient = stripeMock;
  });

  it('creates a billing portal session when a matching subscription exists', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
    stripeMock.subscriptions.search.mockResolvedValue({
      data: [{ customer: 'cus_123' }],
    });
    stripeMock.billingPortal.sessions.create.mockResolvedValue({
      id: 'bps_123',
      url: 'https://billing.stripe.com/session/test_123',
    });

    await expect(
      service.createBillingPortalSession({
        orgId: 'org_1',
        userEmail: 'owner@example.com',
        membershipRole: 'OWNER' as any,
      }),
    ).resolves.toEqual({
      portalUrl: 'https://billing.stripe.com/session/test_123',
      sessionId: 'bps_123',
    });

    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123',
        return_url: 'http://localhost:3000/settings#plan-limits',
      }),
    );
  });

  it('rejects billing portal creation when no billing profile can be resolved', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
    stripeMock.subscriptions.search.mockResolvedValue({ data: [] });
    stripeMock.customers.list.mockResolvedValue({ data: [] });

    await expect(
      service.createBillingPortalSession({
        orgId: 'org_1',
        userEmail: 'owner@example.com',
        membershipRole: 'OWNER' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
