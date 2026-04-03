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
      invoices: {
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

  it('returns billing overview with subscription and invoices for workspace', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1', plan: 'starter' });
    stripeMock.subscriptions.search.mockResolvedValue({ data: [{ customer: 'cus_123' }] });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [
        {
          id: 'sub_123',
          status: 'active',
          metadata: { organizationId: 'org_1' },
          cancel_at_period_end: false,
          items: {
            data: [
              {
                current_period_start: 1714300000,
                current_period_end: 1716900000,
                price: {
                  unit_amount: 2900,
                  currency: 'usd',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      ],
    });
    stripeMock.invoices.list.mockResolvedValue({
      data: [
        {
          id: 'in_1',
          number: 'A-001',
          status: 'paid',
          amount_paid: 2900,
          amount_due: 0,
          currency: 'usd',
          created: 1714300000,
          parent: {
            type: 'subscription_details',
            quote_details: null,
            subscription_details: {
              metadata: { organizationId: 'org_1' },
              subscription: 'sub_123',
            },
          },
          hosted_invoice_url: 'https://example.com/in_1',
          invoice_pdf: 'https://example.com/in_1.pdf',
        },
      ],
    });

    await expect(
      service.getBillingOverview({
        orgId: 'org_1',
        userEmail: 'owner@example.com',
        membershipRole: 'OWNER' as any,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        hasBillingProfile: true,
        customerId: 'cus_123',
        workspacePlan: 'starter',
        subscription: expect.objectContaining({
          id: 'sub_123',
          status: 'active',
          amount: 2900,
          currency: 'USD',
          interval: 'month',
        }),
        invoices: [
          expect.objectContaining({
            id: 'in_1',
            status: 'paid',
            amountPaid: 2900,
            currency: 'USD',
          }),
        ],
      }),
    );
  });

  it('returns no-profile overview when workspace has never started billing', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1', plan: 'free' });
    stripeMock.subscriptions.search.mockResolvedValue({ data: [] });
    stripeMock.customers.list.mockResolvedValue({ data: [] });

    await expect(
      service.getBillingOverview({
        orgId: 'org_1',
        userEmail: 'owner@example.com',
        membershipRole: 'OWNER' as any,
      }),
    ).resolves.toEqual({
      hasBillingProfile: false,
      customerId: null,
      workspacePlan: 'free',
      subscription: null,
      invoices: [],
    });
  });
});
