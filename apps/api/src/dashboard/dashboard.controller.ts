// dashboard.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';

@ApiTags('Dashboard')
@Controller('orgs/:orgId/dashboard')
@UseGuards(AuthGuard, OrgMemberGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  getSummary(@Param('orgId') orgId: string) {
    return this.dashboard.getSummary(orgId);
  }
}
