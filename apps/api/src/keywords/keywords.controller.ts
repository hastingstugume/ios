// keywords.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KeywordsService } from './keywords.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

class CreateKeywordDto {
  @IsString() @MinLength(2) @MaxLength(100) phrase!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

class UpdateKeywordDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) phrase?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Keywords')
@Controller('orgs/:orgId/keywords')
@UseGuards(AuthGuard, OrgMemberGuard)
export class KeywordsController {
  constructor(private keywords: KeywordsService) {}

  @Get() findAll(@Param('orgId') orgId: string) {
    return this.keywords.findAll(orgId);
  }

  @Post() create(@Param('orgId') orgId: string, @Body() dto: CreateKeywordDto) {
    return this.keywords.create(orgId, dto.phrase, dto.description);
  }

  @Patch(':id') update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateKeywordDto) {
    return this.keywords.update(orgId, id, dto);
  }

  @Delete(':id') remove(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.keywords.remove(orgId, id, req.user.id);
  }
}
