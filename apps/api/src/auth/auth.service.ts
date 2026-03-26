// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async register(email: string, password: string, name: string, orgName?: string, invitationToken?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    if (!orgName && !invitationToken) throw new BadRequestException('Organization name or invitation token is required');

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name, emailVerified: true },
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

        return { user, org: invitation.organization };
      }

      const safeOrgName = orgName!.trim();
      const slug = safeOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        + '-' + uuidv4().slice(0, 6);

      const org = await tx.organization.create({
        data: { name: safeOrgName, slug },
      });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: org.id, role: UserRole.OWNER },
      });
      return { user, org };
    });

    await this.prisma.auditLog.create({
      data: { organizationId: result.org.id, userId: result.user.id, action: 'LOGIN' },
    });

    return this.createSession(result.user.id);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (membership) {
      await this.prisma.auditLog.create({
        data: { organizationId: membership.organizationId, userId: user.id, action: 'LOGIN' },
      });
    }

    return this.createSession(user.id);
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
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return { user, memberships };
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
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
