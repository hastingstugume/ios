import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
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
  targetPlan: string;
  userEmail: string;
  membershipRole?: UserRole;
  successPath?: string;
  cancelPath?: string;
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
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          targetPlan,
        },
      },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Checkout session did not return a redirect URL');
    }

    return { checkoutUrl: session.url, sessionId: session.id };
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
        await this.syncOrganizationPlan(organizationId, targetPlan, event.id, 'checkout_completed');
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
          await this.syncOrganizationPlan(organizationId, 'free', event.id, 'subscription_inactive');
          return;
        }

        const targetPlan = this.normalizePaidPlan(subscription.metadata?.targetPlan);
        if (!targetPlan) {
          this.logger.warn(`Skipping subscription update event ${event.id}: missing target plan metadata`);
          return;
        }

        await this.syncOrganizationPlan(organizationId, targetPlan, event.id, 'subscription_updated');
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

    this.logger.log(
      `Updated org ${organizationId} plan ${currentPlan} -> ${plan} via Stripe event ${stripeEventId} (${reason})`,
    );
  }
}
