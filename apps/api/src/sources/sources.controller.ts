// sources.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SourcesService } from './sources.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsString, IsEnum, IsObject, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { SourceType, SourceStatus } from '@prisma/client';

class CreateSourceDto {
  @IsString() name!: string;
  @IsEnum(SourceType) type!: SourceType;
  @IsObject() config!: Record<string, any>;
}

class PreviewSourceDto {
  @IsEnum(SourceType) type!: SourceType;
  @IsObject() config!: Record<string, any>;
}

class UpdateSourceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(SourceStatus) status?: SourceStatus;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

class CreateSavedTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() audience?: string;
  @IsArray() sourceIds!: string[];
  @IsOptional() @IsBoolean() includeKeywords?: boolean;
  @IsOptional() @IsBoolean() includeNegativeKeywords?: boolean;
}

@ApiTags('Sources')
@Controller('orgs/:orgId/sources')
@UseGuards(AuthGuard, OrgMemberGuard)
export class SourcesController {
  constructor(private sources: SourcesService) {}

  @Get() findAll(@Param('orgId') orgId: string) { return this.sources.findAll(orgId); }
  @Get('suggestions') suggestions(@Param('orgId') orgId: string, @Req() req: any) {
    return this.sources.getSuggestedTemplates(orgId, req.user.id);
  }
  @Get('templates') listSavedTemplates(@Param('orgId') orgId: string) {
    return this.sources.listSavedTemplates(orgId);
  }
  @Post('templates') createSavedTemplate(@Param('orgId') orgId: string, @Body() dto: CreateSavedTemplateDto, @Req() req: any) {
    return this.sources.createSavedTemplate(orgId, req.user.id, dto);
  }
  @Post('preview') preview(@Param('orgId') orgId: string, @Body() dto: PreviewSourceDto) {
    return this.sources.preview(orgId, dto);
  }
  @Post(':id/fetch') fetchNow(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.sources.fetchNow(orgId, id, req.user.id);
  }
  @Post() create(@Param('orgId') orgId: string, @Body() dto: CreateSourceDto, @Req() req: any) {
    return this.sources.create(orgId, req.user.id, dto);
  }
  @Patch(':id') update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateSourceDto) {
    return this.sources.update(orgId, id, dto);
  }
  @Delete(':id') remove(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.sources.remove(orgId, id, req.user.id);
  }
}
