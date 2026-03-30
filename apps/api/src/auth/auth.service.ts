// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  async register(email: string, password: string, name: string, invitationToken?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name, emailVerified: false },
      });

      if (invitationToken) {
        const invitation = await tx.invitation.findUnique({
          where: { token: invitationToken },
          include: { organization: true },
        });

        if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
          throw new BadRequestException('Invitation is invalid or expired');
        }

        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
          throw new BadRequestException('Invitation email does not match this account');
        }

        await tx.organizationMember.create({
          data: { userId: user.id, organizationId: invitation.organizationId, role: invitation.role },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
        return { user, joinedOrgId: invitation.organizationId };
      }

      return { user, joinedOrgId: null };
    });

    const verification = await this.createVerificationToken(result.user.id);
    await this.notifications.sendVerificationEmail(result.user.email, result.user.name || 'there', verification.token);

    return { success: true, requiresVerification: true, joinedOrgId: result.joinedOrgId };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.emailVerified) throw new ForbiddenException('Verify your email before signing in');

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (membership) {
      await this.prisma.auditLog.create({
        data: { organizationId: membership.organizationId, userId: user.id, action: 'LOGIN' },
      });
    }

    const session = await this.createSession(user.id);
    return {
      ...session,
      authState: {
        emailVerified: Boolean(user.emailVerified),
        onboardingCompleted: Boolean(user.onboardingCompletedAt),
      },
    };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }

  async validateSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { token } });
      return null;
    }
    return session.user;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        emailVerified: true,
        accountType: true,
        onboardingCompletedAt: true,
      },
    });
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return {
      user,
      memberships,
      authState: {
        emailVerified: Boolean(user?.emailVerified),
        onboardingCompleted: Boolean(user?.onboardingCompletedAt),
      },
    };
  }

  async updateProfile(userId: string, name: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new UnauthorizedException('Password change unavailable');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);

    return { success: true };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return this.createSession(record.userId);
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { success: true };
    if (user.emailVerified) return { success: true, alreadyVerified: true };

    const verification = await this.createVerificationToken(user.id);
    await this.notifications.sendVerificationEmail(user.email, user.name || 'there', verification.token);
    return { success: true };
  }

  async completeOnboarding(userId: string, accountType: AccountType, workspaceName: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.emailVerified) throw new ForbiddenException('Verify your email before completing onboarding');

    const safeName = workspaceName.trim();
    if (!safeName) throw new BadRequestException('Workspace name is required');

    const existingMembership = user.memberships[0];
    let orgId = existingMembership?.organizationId;

    if (!existingMembership) {
      const slug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        + '-' + uuidv4().slice(0, 6);
      const organization = await this.prisma.organization.create({
        data: { name: safeName, slug },
      });
      await this.prisma.organizationMember.create({
        data: { userId, organizationId: organization.id, role: UserRole.OWNER },
      });
      orgId = organization.id;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountType,
        onboardingCompletedAt: new Date(),
      },
    });

    if (orgId) {
      await this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'LOGIN' },
      });
    }

    return { success: true, organizationId: orgId };
  }

  private async createVerificationToken(userId: string) {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    return this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token: `verify_${uuidv4().replace(/-/g, '')}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  private async createSession(userId: string) {
    const expiryDays = this.config.get('SESSION_EXPIRY_DAYS', 30);
    const token = `ses_${uuidv4().replace(/-/g, '')}`;
    const session = await this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      },
    });
    return { token: session.token, expiresAt: session.expiresAt };
  }
}
