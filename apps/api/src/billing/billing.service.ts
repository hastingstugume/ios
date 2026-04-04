import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

type WorkspacePlan = 'free' | 'starter' | 'growth' | 'scale';
type PaidWorkspacePlan = Exclude<WorkspacePlan, 'free'>;

const PLAN_ALIASES: Record<string, WorkspacePlan> = {
  free: 'free',
  starter: 'starter',
  pro: 'growth',
  growth: 'growth',
  team: 'growth',
  scale: 'scale',
  enterprise: 'scale',
};

const WORKSPACE_PLAN_ORDER: WorkspacePlan[] = ['free', 'starter', 'growth', 'scale'];

const STRIPE_PRICE_ENV_MAP: Record<PaidWorkspacePlan, string> = {
  starter: 'STRIPE_PRICE_STARTER_MONTHLY',
  growth: 'STRIPE_PRICE_GROWTH_MONTHLY',
  scale: 'STRIPE_PRICE_SCALE_MONTHLY',
};

interface CreateCheckoutSessionInput {
  orgId: string;
  userId?: string;
  targetPlan: string;
  sourceContext?: string;
  experimentVariant?: string;
  userEmail: string;
  membershipRole?: UserRole;
  successPath?: string;
  cancelPath?: string;
}

interface CreateBillingPortalSessionInput {
  orgId: string;
  userId?: string;
  userEmail: string;
  membershipRole?: UserRole;
  returnPath?: string;
}

interface GetBillingOverviewInput {
  orgId: string;
  userEmail: string;
  membershipRole?: UserRole;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    this.assertBillingAdmin(input.membershipRole);
    if (!input.userEmail) throw new BadRequestException('A valid account email is required for checkout');

    const targetPlan = this.normalizePaidPlan(input.targetPlan);
    if (!targetPlan) throw new BadRequestException('Unsupported plan for checkout');

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true, name: true, plan: true },
    });
    if (!organization) throw new BadRequestException('Workspace not found');

    const currentPlan = this.normalizeWorkspacePlan(organization.plan);
    const currentIdx = WORKSPACE_PLAN_ORDER.indexOf(currentPlan);
    const targetIdx = WORKSPACE_PLAN_ORDER.indexOf(targetPlan);
    if (targetIdx <= currentIdx) {
      throw new BadRequestException('Choose a higher plan to start checkout');
    }

    const priceEnvKey = STRIPE_PRICE_ENV_MAP[targetPlan];
    const priceId = this.config.get<string>(priceEnvKey);
    if (!priceId) {
      throw new ServiceUnavailableException(
        targetPlan === 'scale'
          ? `Scale checkout is not configured yet. Set ${priceEnvKey} in your environment.`
          : `Checkout for ${targetPlan} is not configured yet. Set ${priceEnvKey} in your environment.`,
      );
    }
    if (!priceId.startsWith('price_')) {
      throw new ServiceUnavailableException(
        `Invalid ${priceEnvKey} value. Use a Stripe Price ID (for example: price_123...), not a numeric amount.`,
      );
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const sourceContext = this.normalizeTrackingValue(input.sourceContext) || 'unknown';
    const experimentVariant = this.normalizeTrackingValue(input.experimentVariant) || 'control';
    const successUrl = this.appendQueryParam(
      this.buildAbsoluteUrl(frontendUrl, input.successPath, '/pricing?checkout=success'),
      'session_id',
      '{CHECKOUT_SESSION_ID}',
    );
    const cancelUrl = this.buildAbsoluteUrl(frontendUrl, input.cancelPath, '/pricing?checkout=cancelled');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_email: input.userEmail,
      client_reference_id: organization.id,
      metadata: {
        organizationId: organization.id,
        targetPlan,
        currentPlan,
        sourceContext,
        experimentVariant,
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          targetPlan,
          sourceContext,
          experimentVariant,
        },
      },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Checkout session did not return a redirect URL');
    }

    await this.createBillingAuditLog({
      organizationId: organization.id,
      userId: input.userId,
      action: AuditAction.BILLING_CHECKOUT_STARTED,
      metadata: {
        sessionId: session.id,
        currentPlan,
        targetPlan,
        priceId,
        sourceContext,
        experimentVariant,
      },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async createBillingPortalSession(input: CreateBillingPortalSessionInput) {
    this.assertBillingAdmin(input.membershipRole);
    if (!input.userEmail) throw new BadRequestException('A valid account email is required');

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true },
    });
    if (!organization) throw new BadRequestException('Workspace not found');

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const returnUrl = this.buildAbsoluteUrl(frontendUrl, input.returnPath, '/settings#plan-limits');
    const customerId = await this.resolveBillingCustomerId(input.orgId, input.userEmail);

    let session: Stripe.BillingPortal.Session;
    try {
      session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    } catch (error: any) {
      const stripeMessage = error?.raw?.message || error?.message || '';
      if (/portal/i.test(stripeMessage) && /config|configured|setup|setting/i.test(stripeMessage)) {
        throw new ServiceUnavailableException('Stripe Billing Portal is not configured yet');
      }
      throw new InternalServerErrorException('Could not start billing portal');
    }

    if (!session.url) {
      throw new InternalServerErrorException('Billing portal session did not return a redirect URL');
    }

    await this.createBillingAuditLog({
      organizationId: organization.id,
      userId: input.userId,
      action: AuditAction.BILLING_PORTAL_OPENED,
      metadata: {
        sessionId: session.id,
        customerId,
      },
    });

    return { portalUrl: session.url, sessionId: session.id };
  }

  async getBillingOverview(input: GetBillingOverviewInput) {
    this.assertBillingAdmin(input.membershipRole);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true, plan: true },
    });
    if (!organization) throw new BadRequestException('Workspace not found');

    const customerId = await this.tryResolveBillingCustomerId(input.orgId, input.userEmail);
    if (!customerId) {
      return {
        hasBillingProfile: false,
        customerId: null,
        workspacePlan: this.normalizeWorkspacePlan(organization.plan),
        subscription: null,
        invoices: [],
      };
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });
    const workspaceSubscriptions = subscriptions.data.filter(
      (subscription) => subscription.metadata?.organizationId === input.orgId,
    );
    const scopedSubscriptions = workspaceSubscriptions.length ? workspaceSubscriptions : subscriptions.data;
    const primarySubscription = this.selectPrimarySubscription(scopedSubscriptions);
    const scopedSubscriptionIds = new Set(scopedSubscriptions.map((subscription) => subscription.id));

    const invoices = await this.stripe.invoices.list({ customer: customerId, limit: 20 });
    const scopedInvoices = invoices.data
      .filter((invoice) => {
        const invoiceSubscription = invoice.parent?.subscription_details?.subscription;
        if (!invoiceSubscription) return scopedSubscriptionIds.size === 0;
        const subscriptionId = typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription.id;
        return scopedSubscriptionIds.size ? scopedSubscriptionIds.has(subscriptionId) : true;
      })
      .slice(0, 8);

    const primaryItem = primarySubscription?.items.data[0];
    const normalizedSubscription = primarySubscription
      ? {
          id: primarySubscription.id,
          status: primarySubscription.status,
          cancelAtPeriodEnd: primarySubscription.cancel_at_period_end,
          currentPeriodStart: primaryItem?.current_period_start
            ? new Date(primaryItem.current_period_start * 1000).toISOString()
            : null,
          currentPeriodEnd: primaryItem?.current_period_end
            ? new Date(primaryItem.current_period_end * 1000).toISOString()
            : null,
          amount: primaryItem?.price?.unit_amount ?? null,
          currency: (primaryItem?.price?.currency || 'usd').toUpperCase(),
          interval: primaryItem?.price?.recurring?.interval ?? null,
        }
      : null;

    return {
      hasBillingProfile: true,
      customerId,
      workspacePlan: this.normalizeWorkspacePlan(organization.plan),
      subscription: normalizedSubscription,
      invoices: scopedInvoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        currency: invoice.currency.toUpperCase(),
        createdAt: new Date(invoice.created * 1000).toISOString(),
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
    };
  }

  async handleStripeWebhook(signature: string, rawBody?: Buffer) {
    if (!rawBody?.length) {
      throw new BadRequestException('Webhook payload is empty');
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook signing secret is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    await this.processStripeEvent(event);
    return { received: true };
  }

  private get stripe() {
    if (this.stripeClient) return this.stripeClient;

    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new ServiceUnavailableException('Stripe secret key is not configured');
    }

    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    });

    return this.stripeClient;
  }

  private assertBillingAdmin(role?: UserRole) {
    if (!role || (role !== UserRole.OWNER && role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Only workspace admins can manage billing');
    }
  }

  private normalizeWorkspacePlan(plan?: string | null): WorkspacePlan {
    if (!plan) return 'free';
    return PLAN_ALIASES[plan.trim().toLowerCase()] ?? 'free';
  }

  private normalizePaidPlan(plan?: string | null): PaidWorkspacePlan | null {
    const normalized = this.normalizeWorkspacePlan(plan);
    if (normalized === 'free') return null;
    return normalized;
  }

  private buildAbsoluteUrl(baseUrl: string, pathOrUrl: string | undefined, fallbackPath: string) {
    const rawValue = pathOrUrl?.trim() || fallbackPath;
    const fallback = new URL(fallbackPath, baseUrl).toString();

    try {
      if (/^https?:\/\//i.test(rawValue)) {
        return new URL(rawValue).toString();
      }
      const normalizedPath = rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
      return new URL(normalizedPath, baseUrl).toString();
    } catch {
      return fallback;
    }
  }

  private appendQueryParam(urlValue: string, key: string, value: string) {
    const url = new URL(urlValue);
    url.searchParams.set(key, value);
    return url.toString();
  }

  private async resolveBillingCustomerId(orgId: string, userEmail: string) {
    const searchedCustomerId = await this.findCustomerFromSubscriptionSearch(orgId);
    if (searchedCustomerId) return searchedCustomerId;

    const customers = await this.stripe.customers.list({ email: userEmail, limit: 10 });
    const candidates = customers.data.filter((customer): customer is Stripe.Customer => !('deleted' in customer && customer.deleted));
    if (!candidates.length) {
      throw new BadRequestException('No billing profile found for this workspace. Start with an upgrade checkout first.');
    }

    for (const customer of candidates) {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 20,
      });

      const matchesWorkspace = subscriptions.data.some((subscription) => subscription.metadata?.organizationId === orgId);
      if (matchesWorkspace) {
        return customer.id;
      }
    }

    throw new BadRequestException('No billing profile found for this workspace. Start with an upgrade checkout first.');
  }

  private async tryResolveBillingCustomerId(orgId: string, userEmail: string) {
    try {
      return await this.resolveBillingCustomerId(orgId, userEmail);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return null;
      }
      throw error;
    }
  }

  private async findCustomerFromSubscriptionSearch(orgId: string) {
    try {
      const result = await this.stripe.subscriptions.search({
        query: `metadata['organizationId']:'${orgId}'`,
        limit: 1,
      });

      const subscription = result.data[0];
      if (!subscription?.customer) return null;

      if (typeof subscription.customer === 'string') {
        return subscription.customer;
      }

      if ('id' in subscription.customer && typeof subscription.customer.id === 'string') {
        return subscription.customer.id;
      }

      return null;
    } catch (error: any) {
      this.logger.warn(`Stripe subscription search unavailable while resolving billing customer: ${error?.message || error}`);
      return null;
    }
  }

  private selectPrimarySubscription(subscriptions: Stripe.Subscription[]) {
    if (!subscriptions.length) return null;

    const activeLike = subscriptions.find((subscription) =>
      ['active', 'trialing', 'past_due'].includes(subscription.status),
    );
    if (activeLike) return activeLike;

    return subscriptions[0];
  }

  private async processStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId || session.client_reference_id;
        const targetPlan = this.normalizePaidPlan(session.metadata?.targetPlan);
        if (typeof organizationId !== 'string' || !targetPlan) {
          this.logger.warn(`Skipping checkout completion event ${event.id}: missing org/plan metadata`);
          return;
        }
        await this.syncOrganizationPlan(organizationId, targetPlan, event.id, 'checkout_completed', {
          sourceContext: this.normalizeTrackingValue(session.metadata?.sourceContext),
          experimentVariant: this.normalizeTrackingValue(session.metadata?.experimentVariant),
        });
        return;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) {
          this.logger.warn(`Skipping subscription event ${event.id}: missing organization metadata`);
          return;
        }

        const shouldDowngradeToFree = event.type === 'customer.subscription.deleted'
          || ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);
        if (shouldDowngradeToFree) {
          await this.syncOrganizationPlan(organizationId, 'free', event.id, 'subscription_inactive', {
            sourceContext: this.normalizeTrackingValue(subscription.metadata?.sourceContext),
            experimentVariant: this.normalizeTrackingValue(subscription.metadata?.experimentVariant),
          });
          return;
        }

        const targetPlan = this.normalizePaidPlan(subscription.metadata?.targetPlan);
        if (!targetPlan) {
          this.logger.warn(`Skipping subscription update event ${event.id}: missing target plan metadata`);
          return;
        }

        await this.syncOrganizationPlan(organizationId, targetPlan, event.id, 'subscription_updated', {
          sourceContext: this.normalizeTrackingValue(subscription.metadata?.sourceContext),
          experimentVariant: this.normalizeTrackingValue(subscription.metadata?.experimentVariant),
        });
        return;
      }

      default:
        return;
    }
  }

  private async syncOrganizationPlan(
    organizationId: string,
    plan: WorkspacePlan,
    stripeEventId: string,
    reason: 'checkout_completed' | 'subscription_updated' | 'subscription_inactive',
    attribution?: {
      sourceContext?: string | null;
      experimentVariant?: string | null;
    },
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true },
    });
    if (!organization) {
      this.logger.warn(`Stripe event ${stripeEventId} referenced unknown org ${organizationId}`);
      return;
    }

    const currentPlan = this.normalizeWorkspacePlan(organization.plan);
    if (currentPlan === plan) return;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan },
    });

    await this.createBillingAuditLog({
      organizationId,
      action: AuditAction.BILLING_PLAN_UPDATED,
      metadata: {
        stripeEventId,
        reason,
        previousPlan: currentPlan,
        updatedPlan: plan,
        ...(attribution?.sourceContext ? { sourceContext: attribution.sourceContext } : {}),
        ...(attribution?.experimentVariant ? { experimentVariant: attribution.experimentVariant } : {}),
      },
    });

    this.logger.log(
      `Updated org ${organizationId} plan ${currentPlan} -> ${plan} via Stripe event ${stripeEventId} (${reason})`,
    );
  }

  private async createBillingAuditLog(input: {
    organizationId: string;
    userId?: string;
    action: AuditAction;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          action: input.action,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not persist billing audit log (${input.action}): ${String(error)}`);
    }
  }

  private normalizeTrackingValue(value?: string | null) {
    if (!value) return null;
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '_');
    if (!normalized) return null;
    return normalized.slice(0, 120);
  }
}
