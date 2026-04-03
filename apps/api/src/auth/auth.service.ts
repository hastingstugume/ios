// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AccountType, SourceType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { generateBackupCodes, generateOtpAuthUri, generateTotpSecret, verifyTotpCode } from './totp.util';

type OAuthProvider = 'google' | 'microsoft' | 'github';

type OAuthStart = {
  authorizationUrl: string;
  state: string;
};

type OAuthProfile = {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
};

type OAuthProviderConfig = {
  id: OAuthProvider;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  callbackUrl: string;
};

type AuthState = {
  emailVerified: boolean;
  onboardingCompleted: boolean;
};

type SessionResult = {
  token: string;
  expiresAt: Date;
  authState: AuthState;
  mfaRequired?: false;
};

type MfaChallengeResult = {
  mfaRequired: true;
  challengeToken: string;
  authState: AuthState;
};

type OnboardingStarterPack = {
  id: string;
  name: string;
  audience: string;
  recommendedKeywords: string[];
  source: {
    name: string;
    type: SourceType;
    config: Record<string, any>;
  };
};

const ONBOARDING_STARTER_PACKS: Record<string, OnboardingStarterPack> = {
  'single-freelancer-radar': {
    id: 'single-freelancer-radar',
    name: 'Freelancer Radar',
    audience: 'Freelancers and consultants looking for direct implementation demand',
    recommendedKeywords: ['need freelancer', 'consultant', 'implementation help', 'need support'],
    source: {
      name: 'Ask HN freelancer demand',
      type: SourceType.HN_SEARCH,
      config: {
        query: '"need freelancer" OR "looking for consultant" OR "implementation help"',
        tags: 'story,comment',
        sourceWeight: 1.0,
      },
    },
  },
  'single-web-buyer-intent': {
    id: 'single-web-buyer-intent',
    name: 'B2B Buyer Intent',
    audience: 'Teams looking for broad buyer-intent conversations in operator communities',
    recommendedKeywords: ['looking for consultant', 'need agency', 'implementation partner', 'need help'],
    source: {
      name: 'Web buyer-intent search',
      type: SourceType.WEB_SEARCH,
      config: {
        query: '"looking for consultant" OR "need agency" OR "implementation partner"',
        domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
        excludeTerms: ['course', 'job board'],
        sourceWeight: 1.0,
      },
    },
  },
  'single-shopify-migration-watch': {
    id: 'single-shopify-migration-watch',
    name: 'Shopify Migration Watch',
    audience: 'Shopify experts and agencies looking for replatform and rebuild opportunities',
    recommendedKeywords: ['shopify migration', 'replatform', 'shopify expert', 'store rebuild'],
    source: {
      name: 'Shopify migration requests',
      type: SourceType.WEB_SEARCH,
      config: {
        query: '"shopify migration" OR "moving to shopify" OR "need a shopify expert" OR "store rebuild"',
        domains: ['community.shopify.com', 'news.ycombinator.com', 'indiehackers.com'],
        excludeTerms: ['theme giveaway', 'job opening'],
        sourceWeight: 1.05,
      },
    },
  },
  'single-stackoverflow-urgent': {
    id: 'single-stackoverflow-urgent',
    name: 'Technical Rescue',
    audience: 'Technical consultants solving urgent migration and delivery blockers',
    recommendedKeywords: ['urgent help', 'blocked', 'migration help', 'need support'],
    source: {
      name: 'Stack Overflow rescue issues',
      type: SourceType.STACKOVERFLOW_SEARCH,
      config: {
        query: '"urgent" OR "blocked" OR "migration help" OR "need support"',
        sort: 'activity',
        sourceWeight: 1.0,
      },
    },
  },
};

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

  startOAuth(provider: string) {
    const config = this.getOAuthProviderConfig(provider);
    const state = `oauth_${uuidv4().replace(/-/g, '')}`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    });

    if (config.id === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    return {
      authorizationUrl: `${config.authorizeUrl}?${params.toString()}`,
      state,
    } satisfies OAuthStart;
  }

  async login(
    email: string,
    password: string,
    metadata?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<SessionResult | MfaChallengeResult> {
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

    const authState = this.buildAuthState(user);
    if (this.requiresMfa(user)) {
      return this.createMfaChallenge(user.id, authState);
    }

    const session = await this.createSession(user.id, metadata);
    return { ...session, authState };
  }

  async loginWithOAuth(
    provider: string,
    code: string,
    invitationToken?: string,
    metadata?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<SessionResult | MfaChallengeResult> {
    const config = this.getOAuthProviderConfig(provider);
    const accessToken = await this.exchangeOAuthCode(config, code);
    const profile = await this.fetchOAuthProfile(config.id, accessToken);

    if (!profile.email) {
      throw new BadRequestException(`Unable to determine the ${config.id} account email address`);
    }

    let user = await this.resolveOAuthUser(config.id, profile);
    if (invitationToken) {
      await this.acceptInvitation(user.id, profile.email, invitationToken);
      const refreshedUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { memberships: true },
      });
      if (!refreshedUser) throw new UnauthorizedException('User not found');
      user = refreshedUser;
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (membership) {
      await this.prisma.auditLog.create({
        data: { organizationId: membership.organizationId, userId: user.id, action: 'LOGIN' },
      });
    }

    const authState = this.buildAuthState({
      emailVerified: true,
      onboardingCompletedAt: user.onboardingCompletedAt,
    });
    if (this.requiresMfa(user)) {
      return this.createMfaChallenge(user.id, authState);
    }

    const session = await this.createSession(user.id, metadata);
    return { ...session, authState };
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
        mfaEnabledAt: true,
        onboardingCompletedAt: true,
        passwordHash: true,
        identities: {
          select: {
            provider: true,
          },
        },
      },
    });
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            emailVerified: user.emailVerified,
            accountType: user.accountType,
            onboardingCompletedAt: user.onboardingCompletedAt,
            mfaEnabled: Boolean(user.mfaEnabledAt),
            hasPassword: Boolean(user.passwordHash),
            authProviders: user.identities.map((identity) => identity.provider),
          }
        : null,
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

  async verifyEmail(token: string, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
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

    return this.createSession(record.userId, metadata);
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { success: true };
    if (user.emailVerified) return { success: true, alreadyVerified: true };

    const verification = await this.createVerificationToken(user.id);
    await this.notifications.sendVerificationEmail(user.email, user.name || 'there', verification.token);
    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return { success: true };

    const reset = await this.createPasswordResetToken(user.id);
    await this.notifications.sendPasswordResetEmail(user.email, user.name || 'there', reset.token);
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Password reset link is invalid or expired');
    }
    if (!record.user.passwordHash) {
      throw new BadRequestException('Password reset is unavailable for this account');
    }

    const matchesCurrent = await bcrypt.compare(newPassword, record.user.passwordHash);
    if (matchesCurrent) {
      throw new BadRequestException('New password must be different');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { success: true };
  }

  async completeOnboarding(
    userId: string,
    accountType: AccountType,
    workspaceName: string,
    starterPackId?: string,
  ) {
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
    let createdWorkspace = false;

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
      createdWorkspace = true;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountType,
        onboardingCompletedAt: new Date(),
      },
    });

    if (orgId && createdWorkspace && starterPackId) {
      await this.installStarterPack(orgId, userId, starterPackId);
    }

    if (orgId) {
      await this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'LOGIN' },
      });
    }

    return { success: true, organizationId: orgId };
  }

  private async installStarterPack(orgId: string, userId: string, starterPackId: string) {
    const pack = ONBOARDING_STARTER_PACKS[starterPackId];
    if (!pack) {
      return;
    }

    const [sourceCount, keywordCount, organization] = await Promise.all([
      this.prisma.source.count({ where: { organizationId: orgId } }),
      this.prisma.keyword.count({ where: { organizationId: orgId } }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { businessFocus: true, targetAudience: true },
      }),
    ]);

    if (sourceCount > 0 || keywordCount > 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      if (organization && (!organization.businessFocus || !organization.targetAudience)) {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            ...(organization.businessFocus ? {} : { businessFocus: pack.name }),
            ...(organization.targetAudience ? {} : { targetAudience: pack.audience }),
          },
        });
      }

      await tx.source.create({
        data: {
          organizationId: orgId,
          name: pack.source.name,
          type: pack.source.type,
          config: pack.source.config,
        },
      });

      for (const phrase of pack.recommendedKeywords.slice(0, 6)) {
        await tx.keyword.create({
          data: {
            organizationId: orgId,
            phrase,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'SOURCE_CREATED',
          metadata: {
            seededBy: 'onboarding',
            packId: pack.id,
            sourceName: pack.source.name,
          },
        },
      });
    });
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.emailVerified) throw new ForbiddenException('Verify your email before enabling multi-factor authentication');

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaPendingSecret: secret },
    });

    const issuer = this.config.get<string>('MFA_ISSUER', 'Opportunity Scanner');
    return {
      secret,
      otpauthUri: generateOtpAuthUri({
        accountName: user.email,
        issuer,
        secret,
      }),
      issuer,
    };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, mfaPendingSecret: true },
    });
    if (!user?.mfaPendingSecret) {
      throw new BadRequestException('Start MFA setup before verifying a code');
    }
    if (!verifyTotpCode(user.mfaPendingSecret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((backupCode) => bcrypt.hash(backupCode, 8)));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: user.mfaPendingSecret,
        mfaPendingSecret: null,
        mfaEnabledAt: new Date(),
        mfaBackupCodes: hashedBackupCodes,
      },
    });

    return { success: true, backupCodes };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, mfaSecret: true, mfaBackupCodes: true, mfaEnabledAt: true },
    });
    if (!user?.mfaSecret || !user.mfaEnabledAt) {
      throw new BadRequestException('Multi-factor authentication is not enabled');
    }

    const nextBackupCodes = await this.consumeBackupCode(user.mfaBackupCodes, code);
    const validCode = verifyTotpCode(user.mfaSecret, code) || Boolean(nextBackupCodes);
    if (!validCode) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaPendingSecret: null,
        mfaEnabledAt: null,
        mfaBackupCodes: [],
      },
    });

    return { success: true };
  }

  async verifyMfaLogin(
    challengeToken: string,
    code: string,
    metadata?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { token: challengeToken },
      include: {
        user: {
          select: {
            id: true,
            emailVerified: true,
            onboardingCompletedAt: true,
            mfaSecret: true,
            mfaBackupCodes: true,
          },
        },
      },
    });

    if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Multi-factor challenge is invalid or expired');
    }
    if (!challenge.user?.mfaSecret) {
      throw new BadRequestException('Multi-factor authentication is not enabled for this account');
    }

    const nextBackupCodes = await this.consumeBackupCode(challenge.user.mfaBackupCodes, code);
    const validCode = verifyTotpCode(challenge.user.mfaSecret, code) || Boolean(nextBackupCodes);
    if (!validCode) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.$transaction([
      this.prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      }),
      ...(nextBackupCodes
        ? [
            this.prisma.user.update({
              where: { id: challenge.user.id },
              data: { mfaBackupCodes: nextBackupCodes },
            }),
          ]
        : []),
    ]);

    const session = await this.createSession(challenge.user.id, metadata);
    return {
      ...session,
      authState: this.buildAuthState(challenge.user),
    };
  }

  async listSessions(userId: string, currentToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrent: currentToken ? session.token === currentToken : false,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string, currentToken?: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new BadRequestException('Session not found');
    if (currentToken && session.token === currentToken) {
      throw new BadRequestException('Use standard sign out for the current session');
    }

    await this.prisma.session.delete({
      where: { id: session.id },
    });

    return { success: true };
  }

  async revokeOtherSessions(userId: string, currentToken?: string) {
    const where: any = { userId };
    if (currentToken) {
      where.token = { not: currentToken };
    }

    await this.prisma.session.deleteMany({ where });
    return { success: true };
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

  private async createPasswordResetToken(userId: string) {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    return this.prisma.passwordResetToken.create({
      data: {
        userId,
        token: `reset_${uuidv4().replace(/-/g, '')}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  private getOAuthProviderConfig(provider: string): OAuthProviderConfig {
    const normalized = provider.toLowerCase() as OAuthProvider;
    const apiBaseUrl = this.config.get<string>('API_BASE_URL', 'http://localhost:3001');

    switch (normalized) {
      case 'google': {
        const clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '').trim();
        const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '').trim();
        if (!clientId || !clientSecret) {
          throw new BadRequestException('Google sign-in is not configured');
        }
        return {
          id: 'google',
          clientId,
          clientSecret,
          authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          scopes: ['openid', 'email', 'profile'],
          callbackUrl: `${apiBaseUrl}/api/v1/auth/oauth/google/callback`,
        };
      }
      case 'microsoft': {
        const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID', '').trim();
        const clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET', '').trim();
        const tenantId = this.config.get<string>('MICROSOFT_TENANT_ID', 'common').trim() || 'common';
        if (!clientId || !clientSecret) {
          throw new BadRequestException('Microsoft sign-in is not configured');
        }
        return {
          id: 'microsoft',
          clientId,
          clientSecret,
          authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
          tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          scopes: ['openid', 'profile', 'email', 'User.Read'],
          callbackUrl: `${apiBaseUrl}/api/v1/auth/oauth/microsoft/callback`,
        };
      }
      case 'github': {
        const clientId = this.config.get<string>('GITHUB_CLIENT_ID', '').trim();
        const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET', '').trim();
        if (!clientId || !clientSecret) {
          throw new BadRequestException('GitHub sign-in is not configured');
        }
        return {
          id: 'github',
          clientId,
          clientSecret,
          authorizeUrl: 'https://github.com/login/oauth/authorize',
          tokenUrl: 'https://github.com/login/oauth/access_token',
          scopes: ['read:user', 'user:email'],
          callbackUrl: `${apiBaseUrl}/api/v1/auth/oauth/github/callback`,
        };
      }
      default:
        throw new BadRequestException('Unsupported OAuth provider');
    }
  }

  private async exchangeOAuthCode(config: OAuthProviderConfig, code: string) {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.access_token) {
      throw new BadRequestException(`Unable to complete ${config.id} sign-in`);
    }

    return payload.access_token as string;
  }

  private async fetchOAuthProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
    switch (provider) {
      case 'google': {
        const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload: any = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.sub) throw new BadRequestException('Unable to load Google profile');
        return {
          providerUserId: payload.sub,
          email: payload.email ?? null,
          emailVerified: Boolean(payload.email_verified),
          name: payload.name ?? null,
          avatarUrl: payload.picture ?? null,
        };
      }
      case 'microsoft': {
        const response = await fetch('https://graph.microsoft.com/oidc/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload: any = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.sub) throw new BadRequestException('Unable to load Microsoft profile');
        return {
          providerUserId: payload.sub,
          email: payload.email ?? payload.preferred_username ?? null,
          emailVerified: Boolean(payload.email || payload.preferred_username),
          name: payload.name ?? null,
          avatarUrl: null,
        };
      }
      case 'github': {
        const [profileResponse, emailResponse] = await Promise.all([
          fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'InternetOpportunityScanner',
            },
          }),
          fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'InternetOpportunityScanner',
            },
          }),
        ]);

        const profile: any = await profileResponse.json().catch(() => ({}));
        const emails = (await emailResponse.json().catch(() => [])) as any[];
        if (!profileResponse.ok || !profile?.id) throw new BadRequestException('Unable to load GitHub profile');

        const preferredEmail = Array.isArray(emails)
          ? emails.find((entry) => entry.primary && entry.verified) || emails.find((entry) => entry.verified) || emails[0]
          : null;

        return {
          providerUserId: String(profile.id),
          email: preferredEmail?.email ?? profile.email ?? null,
          emailVerified: Boolean(preferredEmail?.verified ?? profile.email),
          name: profile.name ?? profile.login ?? null,
          avatarUrl: profile.avatar_url ?? null,
        };
      }
    }
  }

  private async resolveOAuthUser(provider: OAuthProvider, profile: OAuthProfile) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (identity) {
      return identity.user;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email! },
      include: { memberships: true },
    });

    if (existingUser) {
      const updatedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          name: existingUser.name || profile.name || undefined,
          avatarUrl: existingUser.avatarUrl || profile.avatarUrl || undefined,
        },
        include: { memberships: true },
      });

      await this.prisma.userIdentity.create({
        data: {
          userId: updatedUser.id,
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
        },
      });

      return updatedUser;
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email!,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: true,
      },
      include: { memberships: true },
    });

    await this.prisma.userIdentity.create({
      data: {
        userId: user.id,
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
      },
    });

    return user;
  }

  private async acceptInvitation(userId: string, email: string, invitationToken: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: invitationToken },
      include: { organization: true },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is invalid or expired');
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Invitation email does not match this account');
    }

    const existingMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId: invitation.organizationId },
    });

    if (!existingMembership) {
      await this.prisma.organizationMember.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: invitation.acceptedAt ?? new Date() },
    });
  }

  private buildAuthState(user: { emailVerified?: boolean | null; onboardingCompletedAt?: Date | null }): AuthState {
    return {
      emailVerified: Boolean(user.emailVerified),
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    };
  }

  private requiresMfa(user: { mfaEnabledAt?: Date | null; mfaSecret?: string | null; passwordHash?: string | null }) {
    return Boolean(user.passwordHash && user.mfaEnabledAt && user.mfaSecret);
  }

  private async createMfaChallenge(userId: string, authState: AuthState): Promise<MfaChallengeResult> {
    await this.prisma.mfaChallenge.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId,
        token: `mfa_${uuidv4().replace(/-/g, '')}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return {
      mfaRequired: true,
      challengeToken: challenge.token,
      authState,
    };
  }

  private async consumeBackupCode(hashedCodes: string[], candidate: string) {
    for (let index = 0; index < hashedCodes.length; index += 1) {
      const hashedCode = hashedCodes[index];
      if (await bcrypt.compare(candidate, hashedCode)) {
        return hashedCodes.filter((_, codeIndex) => codeIndex !== index);
      }
    }

    return null;
  }

  private async createSession(userId: string, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
    const expiryDays = this.config.get('SESSION_EXPIRY_DAYS', 30);
    const token = `ses_${uuidv4().replace(/-/g, '')}`;
    const session = await this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    });
    return { token: session.token, expiresAt: session.expiresAt };
  }
}
