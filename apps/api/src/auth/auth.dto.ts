// auth.dto.ts
import { IsEmail, IsOptional, IsString, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() invitationToken?: string;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() password!: string;
}

export class UpdateProfileDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty() @IsString() token!: string;
}

export class ResendVerificationDto {
  @ApiProperty() @IsEmail() email!: string;
}

export class CompleteOnboardingDto {
  @ApiProperty({ enum: AccountType }) @IsEnum(AccountType) accountType!: AccountType;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) workspaceName!: string;
}
