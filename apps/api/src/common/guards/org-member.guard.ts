import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const orgId = req.params?.orgId || req.body?.organizationId;
    const userId = req.user?.id;

    if (!orgId || !userId) throw new ForbiddenException('Organization context required');

    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this organization');

    req.membership = member;
    return true;
  }
}
