// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async register(email: string, password: string, name: string, orgName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + uuidv4().slice(0, 6);

    const [user, org] = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, name, emailVerified: true },
      });
      const o = await tx.organization.create({
        data: { name: orgName, slug },
      });
      await tx.organizationMember.create({
        data: { userId: u.id, organizationId: o.id, role: 'OWNER' },
      });
      return [u, o];
    });

    await this.prisma.auditLog.create({
      data: { organizationId: org.id, userId: user.id, action: 'LOGIN' },
    });

    return this.createSession(user.id);
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
