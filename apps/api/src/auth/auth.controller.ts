import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RegisterDto, LoginDto } from './auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register and create organization' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.register(dto.email, dto.password, dto.name, dto.organizationName);
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { success: true, expiresAt: session.expiresAt };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password);
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { success: true, expiresAt: session.expiresAt };
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
