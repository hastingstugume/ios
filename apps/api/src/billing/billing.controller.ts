import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { BillingService } from './billing.service';

class CreateCheckoutSessionDto {
  @IsString()
  @IsIn(['starter', 'growth', 'scale'])
  targetPlan!: string;

  @IsOptional()
  @IsString()
  successPath?: string;

  @IsOptional()
  @IsString()
  cancelPath?: string;

  @IsOptional()
  @IsString()
  sourceContext?: string;

  @IsOptional()
  @IsString()
  experimentVariant?: string;
}

class CreateBillingPortalSessionDto {
  @IsOptional()
  @IsString()
  returnPath?: string;
}

@ApiTags('Billing')
@Controller('orgs/:orgId/billing')
@UseGuards(AuthGuard, OrgMemberGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  createCheckoutSession(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: any,
  ) {
    return this.billing.createCheckoutSession({
      orgId,
      targetPlan: dto.targetPlan,
      successPath: dto.successPath,
      cancelPath: dto.cancelPath,
      sourceContext: dto.sourceContext,
      experimentVariant: dto.experimentVariant,
      userId: req.user?.id,
      userEmail: req.user?.email || '',
      membershipRole: req.membership?.role as UserRole | undefined,
    });
  }

  @Post('portal')
  createBillingPortalSession(
    @Param('orgId') orgId: string,
    @Body() dto: CreateBillingPortalSessionDto,
    @Req() req: any,
  ) {
    return this.billing.createBillingPortalSession({
      orgId,
      returnPath: dto.returnPath,
      userId: req.user?.id,
      userEmail: req.user?.email || '',
      membershipRole: req.membership?.role as UserRole | undefined,
    });
  }

  @Get('overview')
  getBillingOverview(@Param('orgId') orgId: string, @Req() req: any) {
    return this.billing.getBillingOverview({
      orgId,
      userEmail: req.user?.email || '',
      membershipRole: req.membership?.role as UserRole | undefined,
    });
  }
}

@ApiTags('Billing')
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') stripeSignature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!stripeSignature) {
      throw new BadRequestException('Missing Stripe signature header');
    }
    return this.billing.handleStripeWebhook(stripeSignature, req.rawBody);
  }
}
