import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type WorkspacePlan = 'free' | 'starter' | 'growth' | 'scale';

export interface WorkspaceEntitlements {
  plan: WorkspacePlan;
  label: string;
  maxSeats: number | null;
  maxSources: number | null;
  maxKeywords: number | null;
  maxAlerts: number | null;
}

const PLAN_ALIASES: Record<string, WorkspacePlan> = {
  free: 'free',
  starter: 'starter',
  pro: 'growth',
  growth: 'growth',
  team: 'growth',
  scale: 'scale',
  enterprise: 'scale',
};

const PLAN_ENTITLEMENTS: Record<WorkspacePlan, WorkspaceEntitlements> = {
  free: {
    plan: 'free',
    label: 'Free',
    maxSeats: 1,
    maxSources: 1,
    maxKeywords: 10,
    maxAlerts: 1,
  },
  starter: {
    plan: 'starter',
    label: 'Starter',
    maxSeats: 1,
    maxSources: 3,
    maxKeywords: 25,
    maxAlerts: 3,
  },
  growth: {
    plan: 'growth',
    label: 'Growth',
    maxSeats: 5,
    maxSources: 15,
    maxKeywords: null,
    maxAlerts: null,
  },
  scale: {
    plan: 'scale',
    label: 'Scale',
    maxSeats: null,
    maxSources: null,
    maxKeywords: null,
    maxAlerts: null,
  },
};

const FREE_FETCH_NOW_COOLDOWN_MINUTES = 15;

@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  normalizePlan(plan?: string | null): WorkspacePlan {
    if (!plan) return 'free';
    return PLAN_ALIASES[plan.trim().toLowerCase()] ?? 'free';
  }

  getPlanEntitlements(plan?: string | null): WorkspaceEntitlements {
    return PLAN_ENTITLEMENTS[this.normalizePlan(plan)];
  }

  async getWorkspaceEntitlements(orgId: string): Promise<WorkspaceEntitlements> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return this.getPlanEntitlements(organization.plan);
  }

  async assertCanAddSeat(orgId: string) {
    const entitlements = await this.getWorkspaceEntitlements(orgId);
    if (entitlements.maxSeats === null) return entitlements;

    const [memberCount, pendingInvitationCount] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId: orgId } }),
      this.prisma.invitation.count({
        where: {
          organizationId: orgId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    this.assertWithinLimit(
      memberCount + pendingInvitationCount,
      entitlements.maxSeats,
      entitlements,
      'team seats',
      'Remove a pending invite or upgrade to add more teammates.',
    );

    return entitlements;
  }

  async assertCanCreateSource(orgId: string) {
    return this.assertResourceLimit(orgId, 'maxSources', 'source', () =>
      this.prisma.source.count({ where: { organizationId: orgId } }),
    );
  }

  async assertCanCreateKeyword(orgId: string) {
    return this.assertResourceLimit(orgId, 'maxKeywords', 'keyword', () =>
      this.prisma.keyword.count({ where: { organizationId: orgId } }),
    );
  }

  async assertCanCreateAlert(orgId: string) {
    return this.assertResourceLimit(orgId, 'maxAlerts', 'alert rule', () =>
      this.prisma.alertRule.count({ where: { organizationId: orgId } }),
    );
  }

  async assertCanFetchNow(orgId: string) {
    const entitlements = await this.getWorkspaceEntitlements(orgId);
    if (entitlements.plan !== 'free') {
      return entitlements;
    }

    const latestSourceFetch = await this.prisma.source.findFirst({
      where: {
        organizationId: orgId,
        lastFetchedAt: { not: null },
      },
      orderBy: { lastFetchedAt: 'desc' },
      select: { lastFetchedAt: true },
    });

    if (!latestSourceFetch?.lastFetchedAt) return entitlements;

    const nextAllowedAt = new Date(
      latestSourceFetch.lastFetchedAt.getTime() + FREE_FETCH_NOW_COOLDOWN_MINUTES * 60 * 1000,
    );
    if (nextAllowedAt <= new Date()) return entitlements;

    const minutesRemaining = Math.max(1, Math.ceil((nextAllowedAt.getTime() - Date.now()) / (60 * 1000)));
    throw new ForbiddenException(
      `Free plan can run Fetch now every ${FREE_FETCH_NOW_COOLDOWN_MINUTES} minutes. Try again in about ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}. Starter and above can run sources on demand without cooldown.`,
    );
  }

  private async assertResourceLimit(
    orgId: string,
    key: keyof Pick<WorkspaceEntitlements, 'maxSources' | 'maxKeywords' | 'maxAlerts'>,
    resourceLabel: string,
    countFn: () => Promise<number>,
  ) {
    const entitlements = await this.getWorkspaceEntitlements(orgId);
    const limit = entitlements[key];
    if (limit === null) return entitlements;

    const count = await countFn();
    this.assertWithinLimit(
      count,
      limit,
      entitlements,
      `${resourceLabel}${limit === 1 ? '' : 's'}`,
      `Delete an existing ${resourceLabel} or upgrade to continue.`,
    );

    return entitlements;
  }

  private assertWithinLimit(
    currentCount: number,
    limit: number,
    entitlements: WorkspaceEntitlements,
    resourceLabel: string,
    upgradeHint: string,
  ) {
    if (currentCount >= limit) {
      throw new ForbiddenException(
        `${entitlements.label} plan allows up to ${limit} ${resourceLabel}. ${upgradeHint}`,
      );
    }
  }
}
