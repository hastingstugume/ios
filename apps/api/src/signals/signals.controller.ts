import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SignalsService, SignalFilters } from './signals.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignalStatus, SignalCategory, SignalStage } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

class SignalFiltersDto implements SignalFilters {
  @IsOptional() @IsEnum(SignalStatus) status?: SignalStatus;
  @IsOptional() @IsEnum(SignalStage) stage?: SignalStage;
  @IsOptional() @IsEnum(SignalCategory) category?: SignalCategory;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) minConfidence?: number;
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() keywordId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number;
}

class UpdateStatusDto {
  @ApiProperty() @IsEnum(SignalStatus) status!: SignalStatus;
}

class UpdateWorkflowDto {
  @ApiProperty({ required: false, enum: SignalStage }) @IsOptional() @IsEnum(SignalStage) stage?: SignalStage;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() assigneeId?: string;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() nextStep?: string;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsDateString() firstResponseAt?: string | null;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsDateString() meetingBookedAt?: string | null;
  @ApiProperty({ required: false, nullable: true, minimum: 0 }) @IsOptional() @IsNumber() @Min(0) pipelineValueUsd?: number | null;
  @ApiProperty({ required: false, nullable: true, minimum: 0 }) @IsOptional() @IsNumber() @Min(0) estimatedHoursSaved?: number | null;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() outcomeNotes?: string | null;
}

class AddAnnotationDto {
  @ApiProperty() @IsString() note!: string;
}

@ApiTags('Signals')
@Controller('orgs/:orgId/signals')
@UseGuards(AuthGuard, OrgMemberGuard)
export class SignalsController {
  constructor(private signals: SignalsService) {}

  @Get()
  @ApiOperation({ summary: 'List signals with filters' })
  findAll(@Param('orgId') orgId: string, @Query() filters: SignalFiltersDto) {
    return this.signals.findAll(orgId, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get signal statistics' })
  getStats(@Param('orgId') orgId: string) {
    return this.signals.getStats(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get signal detail' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.signals.findOne(orgId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update signal status' })
  updateStatus(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.signals.updateStatus(orgId, id, req.user.id, dto.status);
  }

  @Patch(':id/workflow')
  @ApiOperation({ summary: 'Update signal workflow fields' })
  updateWorkflow(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @Req() req: any,
  ) {
    return this.signals.updateWorkflow(orgId, id, req.user.id, dto);
  }

  @Post(':id/annotations')
  @ApiOperation({ summary: 'Add annotation to signal' })
  addAnnotation(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AddAnnotationDto,
    @Req() req: any,
  ) {
    return this.signals.addAnnotation(orgId, id, req.user.id, dto.note);
  }
}
