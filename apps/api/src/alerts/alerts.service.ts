// alerts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SignalCategory, AlertFrequency } from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
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
  }) {
    const rule = await this.prisma.alertRule.create({
      data: { organizationId: orgId, ...data },
    });
    await this.prisma.auditLog.create({
      data: { organizationId: orgId, userId, action: 'ALERT_CREATED', metadata: { name: data.name } },
    });
    return rule;
  }

  async update(orgId: string, id: string, userId: string, data: any) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, organizationId: orgId } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    const updated = await this.prisma.alertRule.update({ where: { id }, data });
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
      include: { source: { select: { name: true } } },
    });
    if (!signal) return;

    for (const rule of rules) {
      await this.notifications.sendAlertEmail(rule.emailRecipients, rule.name, signal as any);
      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date() },
      });
    }
  }
}
