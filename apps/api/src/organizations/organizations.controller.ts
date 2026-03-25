// organizations.controller.ts
import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsOptional, IsString } from 'class-validator';

class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

@ApiTags('Organizations')
@Controller('orgs/:orgId')
@UseGuards(AuthGuard, OrgMemberGuard)
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get() findOne(@Param('orgId') orgId: string) { return this.orgs.findOne(orgId); }

  @Patch() update(@Param('orgId') orgId: string, @Body() dto: UpdateOrgDto, @Req() req: any) {
    return this.orgs.update(orgId, req.user.id, dto);
  }

  @Get('audit-log')
  getAuditLog(
    @Param('orgId') orgId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.orgs.getAuditLog(orgId, page, limit);
  }
}
