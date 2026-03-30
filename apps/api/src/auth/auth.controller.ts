import { Controller, Post, Get, Patch, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto, VerifyEmailDto, ResendVerificationDto, CompleteOnboardingDto } from './auth.dto';

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
    this.setSessionCookie(res, session.token, session.expiresAt);
    return {
      success: true,
      expiresAt: session.expiresAt,
      authState: session.authState,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
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
