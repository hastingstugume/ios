// organizations/organizations.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getUsage(orgId: string) {
    const entitlements = await this.entitlements.getWorkspaceEntitlements(orgId);
    const [sourcesUsed, keywordsUsed, alertsUsed, memberCount, pendingInvitationCount] = await Promise.all([
      this.prisma.source.count({ where: { organizationId: orgId } }),
      this.prisma.keyword.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.alertRule.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.organizationMember.count({ where: { organizationId: orgId } }),
      this.prisma.invitation.count({
        where: {
          organizationId: orgId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    const seatsUsed = memberCount + pendingInvitationCount;

    return {
      plan: entitlements.plan,
      planLabel: entitlements.label,
      resources: {
        sources: this.buildUsageMetric(sourcesUsed, entitlements.maxSources),
        keywords: this.buildUsageMetric(keywordsUsed, entitlements.maxKeywords),
        alerts: this.buildUsageMetric(alertsUsed, entitlements.maxAlerts),
        seats: this.buildUsageMetric(seatsUsed, entitlements.maxSeats),
      },
    };
  }

  async update(
    id: string,
    userId: string,
    role: UserRole,
    data: { name?: string; logoUrl?: string; businessFocus?: string; targetAudience?: string; negativeKeywords?: string[] },
  ) {
    this.assertAdmin(role);
    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        ...data,
        ...(data.businessFocus !== undefined ? { businessFocus: data.businessFocus.trim() || null } : {}),
        ...(data.targetAudience !== undefined ? { targetAudience: data.targetAudience.trim() || null } : {}),
        ...(data.negativeKeywords
          ? {
              negativeKeywords: data.negativeKeywords
                .map((term) => term.trim())
                .filter(Boolean),
            }
          : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: { organizationId: id, userId, action: 'ORG_SETTINGS_UPDATED' },
    });
    return org;
  }

  async getAuditLog(orgId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { organizationId: orgId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async listMembers(orgId: string) {
    const [members, invitations] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true } },
        },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { members, invitations };
  }

  async inviteMember(orgId: string, actorUserId: string, actorRole: UserRole, email: string, role: UserRole) {
    this.assertAdmin(actorRole);
    this.assertRoleAssignment(actorRole, role);
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const normalizedEmail = email.trim().toLowerCase();
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId: orgId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) throw new BadRequestException('A pending invitation already exists for this email');

    const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const existingMembership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (existingMembership) throw new BadRequestException('User is already a member of this workspace');

      await this.entitlements.assertCanAddSeat(orgId);
      const member = await this.prisma.organizationMember.create({
        data: { organizationId: orgId, userId: existingUser.id, role },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true } } },
      });
      await this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: actorUserId,
          action: 'INVITE_SENT',
          metadata: { email: normalizedEmail, role, membershipCreated: true },
        },
      });
      await this.notifications.sendWorkspaceAccessGrantedEmail(normalizedEmail, organization.name, role);
      return { type: 'member', member };
    }

    await this.entitlements.assertCanAddSeat(orgId);
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email: normalizedEmail,
        role,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actorUserId,
        action: 'INVITE_SENT',
        metadata: { email: normalizedEmail, role, invitationId: invitation.id, invitationToken: invitation.token },
      },
    });
    await this.notifications.sendWorkspaceInvitationEmail(normalizedEmail, organization.name, role, invitation.token);
    return { type: 'invitation', invitation };
  }

  async updateMemberRole(orgId: string, memberId: string, actorUserId: string, actorRole: UserRole, role: UserRole) {
    this.assertAdmin(actorRole);
    this.assertRoleAssignment(actorRole, role);

    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === UserRole.OWNER && actorRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only owners can change the owner role');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actorUserId,
        action: 'ORG_SETTINGS_UPDATED',
        metadata: { memberId, email: member.user.email, role },
      },
    });
    return updated;
  }

  async removeMember(orgId: string, memberId: string, actorUserId: string, actorRole: UserRole) {
    this.assertAdmin(actorRole);

    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === UserRole.OWNER) throw new ForbiddenException('Owner cannot be removed');
    if (member.userId === actorUserId) throw new BadRequestException('Use sign out to leave the workspace');

    await Promise.all([
      this.prisma.organizationMember.delete({ where: { id: memberId } }),
      this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: actorUserId,
          action: 'MEMBER_REMOVED',
          metadata: { memberId, email: member.user.email },
        },
      }),
    ]);
    return { success: true };
  }

  private assertAdmin(role?: UserRole) {
    if (!role || (role !== UserRole.OWNER && role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private assertRoleAssignment(actorRole: UserRole, targetRole: UserRole) {
    if (actorRole !== UserRole.OWNER && targetRole === UserRole.OWNER) {
      throw new ForbiddenException('Only owners can assign owner role');
    }
  }

  private buildUsageMetric(used: number, limit: number | null) {
    if (limit === null) {
      return {
        used,
        limit: null,
        remaining: null,
        percentUsed: null,
        atLimit: false,
      };
    }

    const remaining = Math.max(limit - used, 0);
    const normalizedPercent = limit > 0 ? Math.round((Math.min(used, limit) / limit) * 100) : 0;

    return {
      used,
      limit,
      remaining,
      percentUsed: normalizedPercent,
      atLimit: used >= limit,
    };
  }
}
