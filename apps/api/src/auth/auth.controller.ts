import { Controller, Post, Get, Patch, Body, Req, Res, UseGuards, HttpCode, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto, VerifyEmailDto, ResendVerificationDto, CompleteOnboardingDto, RequestPasswordResetDto, ResetPasswordDto, VerifyMfaLoginDto, EnableMfaDto, DisableMfaDto } from './auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Register and send verification email' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('session_token');
    return this.auth.register(dto.email, dto.password, dto.name, dto.invitationToken);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Login' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password);
    if ('mfaRequired' in session && session.mfaRequired) {
      res.clearCookie('session_token');
      return session;
    }
    this.setSessionCookie(res, session.token, session.expiresAt);
    return {
      success: true,
      expiresAt: session.expiresAt,
      authState: session.authState,
    };
  }

  @Get('oauth/:provider/start')
  @ApiOperation({ summary: 'Start OAuth sign-in' })
  async oauthStart(
    @Param('provider') provider: string,
    @Query('invitationToken') invitationToken: string | undefined,
    @Res() res: Response,
  ) {
    const oauth = this.auth.startOAuth(provider);
    res.cookie('oauth_state', oauth.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    res.cookie('oauth_provider', provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    if (invitationToken) {
      res.cookie('oauth_invitation_token', invitationToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
    }
    return res.redirect(oauth.authorizationUrl);
  }

  @Get('oauth/:provider/callback')
  @ApiOperation({ summary: 'Handle OAuth callback' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirect = new URL('/login', frontendUrl);

    if (error) {
      redirect.searchParams.set('error', error);
      return res.redirect(redirect.toString());
    }

    if (!code || !state || req.cookies?.oauth_state !== state || req.cookies?.oauth_provider !== provider) {
      redirect.searchParams.set('error', 'oauth_state_mismatch');
      return res.redirect(redirect.toString());
    }

    const invitationToken = req.cookies?.oauth_invitation_token;
    const session = await this.auth.loginWithOAuth(provider, code, invitationToken);
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('oauth_provider', { path: '/' });
    res.clearCookie('oauth_invitation_token', { path: '/' });

    if ('mfaRequired' in session && session.mfaRequired) {
      const mfaRedirect = new URL('/login', frontendUrl);
      mfaRedirect.searchParams.set('mfa', '1');
      mfaRedirect.searchParams.set('challenge', session.challengeToken);
      return res.redirect(mfaRedirect.toString());
    }

    this.setSessionCookie(res, session.token, session.expiresAt);

    const destination = session.authState.onboardingCompleted ? '/dashboard' : '/onboarding';
    return res.redirect(new URL(destination, frontendUrl).toString());
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.session_token;
    if (token) await this.auth.logout(token);
    res.clearCookie('session_token');
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user and memberships' })
  async me(@Req() req: any) {
    return this.auth.getMe(req.user.id);
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email and create a session' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.verifyEmail(dto.token);
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { success: true, expiresAt: session.expiresAt };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Post('request-password-reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete sign-in with a multi-factor authentication code' })
  async verifyMfaLogin(@Body() dto: VerifyMfaLoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.verifyMfaLogin(dto.challengeToken, dto.code);
    this.setSessionCookie(res, session.token, session.expiresAt);
    return {
      success: true,
      expiresAt: session.expiresAt,
      authState: session.authState,
    };
  }

  @Post('onboarding')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete post-signup onboarding' })
  async completeOnboarding(@Req() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.auth.completeOnboarding(req.user.id, dto.accountType, dto.workspaceName);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(req.user.id, dto.name);
  }

  @Patch('password')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('mfa/setup')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Prepare authenticator-based MFA setup' })
  async setupMfa(@Req() req: any) {
    return this.auth.setupMfa(req.user.id);
  }

  @Post('mfa/enable')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Enable MFA after verifying an authenticator code' })
  async enableMfa(@Req() req: any, @Body() dto: EnableMfaDto) {
    return this.auth.enableMfa(req.user.id, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable MFA using a current authenticator or backup code' })
  async disableMfa(@Req() req: any, @Body() dto: DisableMfaDto) {
    return this.auth.disableMfa(req.user.id, dto.code);
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
  }
}
