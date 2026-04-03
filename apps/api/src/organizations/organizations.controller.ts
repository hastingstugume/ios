// organizations.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrganizationsService } from './organizations.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() businessFocus?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) negativeKeywords?: string[];
}

class InviteMemberDto {
  @IsEmail() email!: string;
  @IsEnum(UserRole) role!: UserRole;
}

class UpdateMemberDto {
  @IsEnum(UserRole) role!: UserRole;
}

@ApiTags('Organizations')
@Controller('orgs/:orgId')
@UseGuards(AuthGuard, OrgMemberGuard)
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get() findOne(@Param('orgId') orgId: string) { return this.orgs.findOne(orgId); }

  @Get('usage') getUsage(@Param('orgId') orgId: string) {
    return this.orgs.getUsage(orgId);
  }

  @Patch() update(@Param('orgId') orgId: string, @Body() dto: UpdateOrgDto, @Req() req: any) {
    return this.orgs.update(orgId, req.user.id, req.membership?.role, dto);
  }

  @Get('audit-log')
  getAuditLog(
    @Param('orgId') orgId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('rangeDays') rangeDaysRaw?: string,
    @Query('actions') actionsRaw?: string,
  ) {
    const parsedRangeDays = rangeDaysRaw ? Number.parseInt(rangeDaysRaw, 10) : Number.NaN;
    const rangeDays = Number.isFinite(parsedRangeDays) && parsedRangeDays > 0
      ? Math.min(parsedRangeDays, 365)
      : undefined;
    const actions = actionsRaw
      ? actionsRaw.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
      : undefined;

    return this.orgs.getAuditLog(orgId, page, limit, { rangeDays, actions });
  }

  @Get('members')
  listMembers(@Param('orgId') orgId: string) {
    return this.orgs.listMembers(orgId);
  }

  @Post('members')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  inviteMember(@Param('orgId') orgId: string, @Body() dto: InviteMemberDto, @Req() req: any) {
    return this.orgs.inviteMember(orgId, req.user.id, req.membership?.role, dto.email, dto.role);
  }

  @Patch('members/:memberId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  updateMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: any,
  ) {
    return this.orgs.updateMemberRole(orgId, memberId, req.user.id, req.membership?.role, dto.role);
  }

  @Delete('members/:memberId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  removeMember(@Param('orgId') orgId: string, @Param('memberId') memberId: string, @Req() req: any) {
    return this.orgs.removeMember(orgId, memberId, req.user.id, req.membership?.role);
  }
}
