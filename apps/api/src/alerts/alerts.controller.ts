// alerts.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsString, IsOptional, IsNumber, IsArray, IsEnum, IsEmail, Min, Max, IsBoolean } from 'class-validator';
import { SignalCategory, AlertFrequency, SignalStage } from '@prisma/client';

class CreateAlertDto {
  @IsString() name!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minConfidence?: number;
  @IsOptional() @IsArray() @IsEnum(SignalCategory, { each: true }) categories?: SignalCategory[];
  @IsOptional() @IsArray() @IsString({ each: true }) keywordIds?: string[];
  @IsOptional() @IsEnum(AlertFrequency) frequency?: AlertFrequency;
  @IsArray() @IsEmail({}, { each: true }) emailRecipients!: string[];
  @IsOptional() @IsEnum(SignalStage) autoStage?: SignalStage;
  @IsOptional() @IsString() autoAssignUserId?: string;
  @IsOptional() @IsString() autoNextStep?: string;
}

class UpdateAlertDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minConfidence?: number;
  @IsOptional() @IsArray() @IsEnum(SignalCategory, { each: true }) categories?: SignalCategory[];
  @IsOptional() @IsArray() @IsString({ each: true }) keywordIds?: string[];
  @IsOptional() @IsEnum(AlertFrequency) frequency?: AlertFrequency;
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) emailRecipients?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(SignalStage) autoStage?: SignalStage | null;
  @IsOptional() @IsString() autoAssignUserId?: string | null;
  @IsOptional() @IsString() autoNextStep?: string | null;
}

@ApiTags('Alerts')
@Controller('orgs/:orgId/alerts')
@UseGuards(AuthGuard, OrgMemberGuard)
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get() findAll(@Param('orgId') orgId: string) { return this.alerts.findAll(orgId); }
  @Post() create(@Param('orgId') orgId: string, @Body() dto: CreateAlertDto, @Req() req: any) {
    return this.alerts.create(orgId, req.user.id, dto);
  }
  @Patch(':id') update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateAlertDto, @Req() req: any) {
    return this.alerts.update(orgId, id, req.user.id, dto);
  }
  @Delete(':id') remove(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.alerts.remove(orgId, id, req.user.id);
  }
}
