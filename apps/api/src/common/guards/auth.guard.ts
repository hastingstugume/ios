import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.session_token
      || req.headers?.authorization?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('Authentication required');

    const user = await this.auth.validateSession(token);
    if (!user) throw new UnauthorizedException('Session expired or invalid');

    req.user = user;
    return true;
  }
}
