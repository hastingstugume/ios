import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, SignalStage, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type LifecycleTemplate = 'near_limit' | 'inactivity_recovery';

type UsageSnapshot = {
  sources: { used: number; limit: number | null; percentUsed: number | null };
  keywords: { used: number; limit: number | null; percentUsed: number | null };
  alerts: { used: number; limit: number | null; percentUsed: number | null };
  seats: { used: number; limit: number | null; percentUsed: number | null };
};

@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async evaluateLifecycleEmails() {
    if (!this.isLifecycleEmailEnabled()) return;

    const organizations = await this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        members: {
          where: { role: { in: [UserRole.OWNER, UserRole.ADMIN] } },
          select: { user: { select: { email: true } } },
        },
      },
    });

    for (const organization of organizations) {
      const normalizedPlan = this.entitlements.normalizePlan(organization.plan);
      if (normalizedPlan === 'free') continue;

      const recipients = [...new Set(
        organization.members
          .map((member) => member.user.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      )];
      if (!recipients.length) continue;

      try {
        await this.maybeSendNearLimitNudge(organization.id, organization.name, organization.plan, recipients);
        await this.maybeSendInactivityRecoveryNudge(organization.id, organization.name, organization.plan, recipients);
      } catch (error: any) {
        this.logger.warn(
          `Lifecycle email evaluation failed for org ${organization.id}: ${error?.message || error}`,
        );
      }
    }
  }

  private isLifecycleEmailEnabled() {
    const raw = this.config.get<string>('BILLING_LIFECYCLE_EMAILS_ENABLED', 'true').trim().toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(raw);
  }

  private async maybeSendNearLimitNudge(
    organizationId: string,
    workspaceName: string,
    workspacePlan: string,
    recipients: string[],
  ) {
    const cooldownHours = Number(this.config.get('BILLING_NEAR_LIMIT_EMAIL_COOLDOWN_HOURS', 72));
    const thresholdPercent = Number(this.config.get('BILLING_NEAR_LIMIT_THRESHOLD_PERCENT', 80));

    if (await this.hasRecentLifecycleEmail(organizationId, 'near_limit', cooldownHours)) {
      return;
    }

    const usage = await this.getUsageSnapshot(organizationId, workspacePlan);
    const constrainedResources = [
      { label: 'Sources', ...usage.sources },
      { label: 'Keywords', ...usage.keywords },
      { label: 'Alerts', ...usage.alerts },
      { label: 'Seats', ...usage.seats },
    ]
      .filter((resource) => resource.limit !== null && (resource.percentUsed ?? 0) >= thresholdPercent)
      .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0));

    if (!constrainedResources.length) return;

    const planLabel = this.entitlements.getPlanEntitlements(workspacePlan).label;
    await this.notifications.sendNearLimitUpgradeEmail(
      recipients,
      workspaceName,
      planLabel,
      constrainedResources.map((resource) => ({
        label: resource.label,
        used: resource.used,
        limit: resource.limit || 0,
        percentUsed: resource.percentUsed || 0,
      })),
    );

    await this.logLifecycleEmail(organizationId, 'near_limit', {
      constrainedResources: constrainedResources.map((resource) => ({
        label: resource.label,
        used: resource.used,
        limit: resource.limit,
        percentUsed: resource.percentUsed,
      })),
      thresholdPercent,
    });
  }

  private async maybeSendInactivityRecoveryNudge(
    organizationId: string,
    workspaceName: string,
    workspacePlan: string,
    recipients: string[],
  ) {
    const inactivityDays = Number(this.config.get('BILLING_INACTIVITY_RECOVERY_DAYS', 7));
    const cooldownHours = Number(this.config.get('BILLING_INACTIVITY_EMAIL_COOLDOWN_HOURS', 168));
    if (await this.hasRecentLifecycleEmail(organizationId, 'inactivity_recovery', cooldownHours)) {
      return;
    }

    const since = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);
    const [activeSources, activeKeywords, signalCount, activePipelineTouches] = await Promise.all([
      this.prisma.source.count({ where: { organizationId } }),
      this.prisma.keyword.count({ where: { organizationId, isActive: true } }),
      this.prisma.signal.count({ where: { organizationId } }),
      this.prisma.signal.count({
        where: {
          organizationId,
          stage: { in: [SignalStage.IN_PROGRESS, SignalStage.OUTREACH, SignalStage.QUALIFIED, SignalStage.WON] },
          updatedAt: { gte: since },
        },
      }),
    ]);

    // Only nudge workspaces that have setup and discovered enough signals to act on.
    if (activeSources < 1 || activeKeywords < 1 || signalCount < 5) {
      return;
    }
    if (activePipelineTouches > 0) {
      return;
    }

    const planLabel = this.entitlements.getPlanEntitlements(workspacePlan).label;
    await this.notifications.sendInactivityRecoveryEmail(
      recipients,
      workspaceName,
      planLabel,
      inactivityDays,
    );

    await this.logLifecycleEmail(organizationId, 'inactivity_recovery', {
      inactivityDays,
      signalCount,
      activeSources,
      activeKeywords,
    });
  }

  private async hasRecentLifecycleEmail(
    organizationId: string,
    template: LifecycleTemplate,
    cooldownHours: number,
  ) {
    const since = new Date(Date.now() - Math.max(cooldownHours, 1) * 60 * 60 * 1000);
    const recentSystemLogs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        action: AuditAction.ORG_SETTINGS_UPDATED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return recentSystemLogs.some((entry) => {
      const metadata = (entry.metadata || {}) as Record<string, unknown>;
      return metadata.systemEvent === 'LIFECYCLE_EMAIL_SENT' && metadata.template === template;
    });
  }

  private async logLifecycleEmail(
    organizationId: string,
    template: LifecycleTemplate,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action: AuditAction.ORG_SETTINGS_UPDATED,
        metadata: {
          systemEvent: 'LIFECYCLE_EMAIL_SENT',
          template,
          ...(metadata || {}),
        } as any,
      },
    });
  }

  private async getUsageSnapshot(organizationId: string, workspacePlan: string): Promise<UsageSnapshot> {
    const entitlements = this.entitlements.getPlanEntitlements(workspacePlan);
    const [sourcesUsed, keywordsUsed, alertsUsed, memberCount, pendingInvitationCount] = await Promise.all([
      this.prisma.source.count({ where: { organizationId } }),
      this.prisma.keyword.count({ where: { organizationId, isActive: true } }),
      this.prisma.alertRule.count({ where: { organizationId, isActive: true } }),
      this.prisma.organizationMember.count({ where: { organizationId } }),
      this.prisma.invitation.count({
        where: {
          organizationId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    const seatsUsed = memberCount + pendingInvitationCount;

    return {
      sources: this.toUsageMetric(sourcesUsed, entitlements.maxSources),
      keywords: this.toUsageMetric(keywordsUsed, entitlements.maxKeywords),
      alerts: this.toUsageMetric(alertsUsed, entitlements.maxAlerts),
      seats: this.toUsageMetric(seatsUsed, entitlements.maxSeats),
    };
  }

  private toUsageMetric(used: number, limit: number | null) {
    if (limit === null) {
      return { used, limit, percentUsed: null };
    }
    return {
      used,
      limit,
      percentUsed: limit > 0 ? Math.round((Math.min(used, limit) / limit) * 100) : 0,
    };
  }
}
