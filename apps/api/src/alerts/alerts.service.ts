// alerts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SignalCategory, AlertFrequency, Prisma, SignalStage } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  async findAll(orgId: string) {
    return this.prisma.alertRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, userId: string, data: {
    name: string;
    minConfidence?: number;
    categories?: SignalCategory[];
    keywordIds?: string[];
    frequency?: AlertFrequency;
    emailRecipients: string[];
    autoStage?: SignalStage;
    autoAssignUserId?: string;
    autoNextStep?: string;
  }) {
    await this.entitlements.assertCanCreateAlert(orgId);
    await this.assertAssignableMember(orgId, data.autoAssignUserId);
    const createData: Prisma.AlertRuleUncheckedCreateInput = {
      organizationId: orgId,
      name: data.name,
      minConfidence: data.minConfidence ?? 70,
      categories: data.categories ?? [],
      keywordIds: data.keywordIds ?? [],
      frequency: data.frequency ?? 'DAILY',
      emailRecipients: data.emailRecipients,
      autoStage: data.autoStage ?? null,
      autoAssignUserId: data.autoAssignUserId || null,
      autoNextStep: data.autoNextStep?.trim() || null,
    };
    const rule = await this.prisma.alertRule.create({
      data: createData,
    });
    await this.prisma.auditLog.create({
      data: { organizationId: orgId, userId, action: 'ALERT_CREATED', metadata: { name: data.name } },
    });
    return rule;
  }

  async update(orgId: string, id: string, userId: string, data: any) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, organizationId: orgId } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    await this.assertAssignableMember(orgId, data.autoAssignUserId);
    const updateData: Prisma.AlertRuleUncheckedUpdateInput = {
      ...data,
      ...(data.autoNextStep !== undefined ? { autoNextStep: data.autoNextStep?.trim() || null } : {}),
      ...(data.autoAssignUserId !== undefined ? { autoAssignUserId: data.autoAssignUserId || null } : {}),
    };
    const updated = await this.prisma.alertRule.update({
      where: { id },
      data: updateData,
    });
    await this.prisma.auditLog.create({
      data: { organizationId: orgId, userId, action: 'ALERT_UPDATED', metadata: { name: rule.name } },
    });
    return updated;
  }

  async remove(orgId: string, id: string, userId: string) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, organizationId: orgId } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    await Promise.all([
      this.prisma.alertRule.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'ALERT_DELETED', metadata: { name: rule.name } },
      }),
    ]);
    return { success: true };
  }

  async checkAndTrigger(orgId: string, signalId: string, confidenceScore: number, category: SignalCategory) {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        minConfidence: { lte: confidenceScore },
        frequency: 'IMMEDIATE',
        OR: [
          { categories: { isEmpty: true } },
          { categories: { has: category } },
        ],
      },
    });

    if (!rules.length) return;

    const signal = await this.prisma.signal.findUnique({
      where: { id: signalId },
      include: {
        source: { select: { name: true } },
        keywords: { select: { keywordId: true } },
      },
    });
    if (!signal) return;
    const signalKeywordIds = new Set(signal.keywords.map((item) => item.keywordId));

    for (const rule of rules) {
      if (rule.keywordIds.length && !rule.keywordIds.some((keywordId) => signalKeywordIds.has(keywordId))) {
        continue;
      }
      await this.applyWorkflowAutomationIfEligible(orgId, signalId, {
        autoStage: rule.autoStage ?? null,
        autoAssignUserId: rule.autoAssignUserId ?? null,
        autoNextStep: rule.autoNextStep ?? null,
      });
      await this.notifications.sendAlertEmail(rule.emailRecipients, rule.name, signal as any);
      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date() },
      });
    }
  }

  private async assertAssignableMember(orgId: string, userId?: string | null) {
    if (!userId) return;

    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId: orgId, userId },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('Automation assignee must belong to this workspace');
    }
  }

  private async applyWorkflowAutomationIfEligible(
    orgId: string,
    signalId: string,
    rule: { autoStage: SignalStage | null; autoAssignUserId: string | null; autoNextStep: string | null },
  ) {
    if (!rule.autoStage && !rule.autoAssignUserId && !rule.autoNextStep) return;

    const existing = await this.prisma.signal.findFirst({
      where: { id: signalId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        stage: true,
        assigneeId: true,
        nextStep: true,
        closedAt: true,
      },
    });

    if (!existing) return;

    const isUntouched =
      existing.stage === 'TO_REVIEW' &&
      !existing.assigneeId &&
      !existing.nextStep &&
      !existing.closedAt;

    const data: Prisma.SignalUncheckedUpdateInput = {};

    if (rule.autoStage && isUntouched) {
      data.stage = rule.autoStage;
      if (rule.autoStage !== 'TO_REVIEW' && existing.status === 'NEW') {
        data.status = 'SAVED';
      }
      if (['WON', 'LOST', 'ARCHIVED'].includes(rule.autoStage)) {
        data.closedAt = existing.closedAt ?? new Date();
      }
    }

    if (rule.autoAssignUserId && !existing.assigneeId) {
      data.assigneeId = rule.autoAssignUserId;
    }

    if (rule.autoNextStep && !existing.nextStep) {
      data.nextStep = rule.autoNextStep;
    }

    if (!Object.keys(data).length) return;

    if (!('closedAt' in data) && existing.closedAt && (!rule.autoStage || !['WON', 'LOST', 'ARCHIVED'].includes(rule.autoStage))) {
      data.closedAt = existing.closedAt;
    }

    await this.prisma.signal.update({
      where: { id: signalId },
      data,
    });
  }
}
