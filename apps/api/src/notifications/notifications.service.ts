import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly apiKey?: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('SENDGRID_API_KEY')?.trim();
    this.fromEmail = this.config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@opportunity-scanner.io');
    this.fromName = this.config.get<string>('SENDGRID_FROM_NAME', 'Internet Opportunity Scanner');

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    } else {
      this.logger.warn('SENDGRID_API_KEY is not configured. Email delivery is disabled.');
    }
  }

  private appUrl(path = '') {
    const baseUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    return `${baseUrl}${path}`;
  }

  private async sendEmail({ to, subject, html }: EmailPayload) {
    if (!this.apiKey) {
      this.logger.warn(`Skipping email "${subject}" because SendGrid is not configured.`);
      return;
    }

    try {
      await sgMail.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html,
      });
    } catch (error) {
      const err = error as { response?: { body?: unknown } };
      this.logger.error(`Failed to send email "${subject}"`, err.response?.body ?? error);
    }
  }

  async sendAlertEmail(recipients: string[], ruleName: string, signal: any) {
    const subject = `🎯 New Opportunity Alert: ${signal.originalTitle?.slice(0, 60) || 'New Signal'}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #f8fafc; margin: 0; font-size: 18px;">Internet Opportunity Scanner</h2>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Alert: ${ruleName}</p>
        </div>
        <div style="background: #1e293b; padding: 24px; border-radius: 0 0 8px 8px;">
          <div style="background: #0f172a; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #22c55e; font-size: 13px; font-weight: 600;">CONFIDENCE: ${signal.confidenceScore}%</span>
              <span style="color: #64748b; font-size: 12px;">${signal.source?.name}</span>
            </div>
            <h3 style="color: #f8fafc; margin: 0 0 8px; font-size: 15px;">${signal.originalTitle || 'Untitled'}</h3>
            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 12px; line-height: 1.5;">${(signal.normalizedText || signal.originalText || '').slice(0, 300)}...</p>
            ${signal.whyItMatters ? `<p style="color: #60a5fa; font-size: 13px; margin: 0;"><strong>Why it matters:</strong> ${signal.whyItMatters}</p>` : ''}
          </div>
          ${signal.suggestedOutreach ? `
          <div style="background: #166534; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <p style="color: #bbf7d0; font-size: 13px; margin: 0;"><strong>Suggested outreach:</strong> ${signal.suggestedOutreach}</p>
          </div>` : ''}
          <a href="${signal.sourceUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-right: 8px;">View Original Post</a>
          <a href="${this.appUrl()}" style="display: inline-block; background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Open Dashboard</a>
        </div>
      </div>
    `;

    await this.sendEmail({ to: recipients, subject, html });
  }

  async sendWelcomeEmail(email: string, name: string) {
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; padding: 32px; border-radius: 8px;">
        <h1 style="color: #f8fafc; font-size: 22px;">Welcome to Internet Opportunity Scanner</h1>
        <p style="color: #94a3b8; line-height: 1.6;">Hi ${name}, your account is ready. Start by adding keywords to monitor and connecting your first source.</p>
        <a href="${this.appUrl()}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; margin-top: 16px;">Get Started</a>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Internet Opportunity Scanner',
      html,
    });
  }

  async sendWorkspaceInvitationEmail(email: string, workspaceName: string, role: string, invitationToken: string) {
    const inviteUrl = this.appUrl(`/register?invitationToken=${invitationToken}`);
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 28px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 22px;">You've been invited to ${workspaceName}</h1>
          <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px; line-height: 1.6;">
            Join the workspace to review signals, manage alerts, and collaborate with the rest of the team.
          </p>
        </div>
        <div style="background: #111827; padding: 28px; border-radius: 0 0 12px 12px;">
          <div style="background: #0f172a; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; margin-bottom: 18px;">
            <p style="margin: 0; color: #cbd5e1; font-size: 13px;"><strong>Workspace:</strong> ${workspaceName}</p>
            <p style="margin: 8px 0 0; color: #cbd5e1; font-size: 13px;"><strong>Role:</strong> ${role}</p>
          </div>
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg,#0ea5e9,#22d3ee); color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">Accept invitation</a>
          <p style="color: #64748b; font-size: 12px; margin: 18px 0 0; line-height: 1.6;">
            If the button does not work, copy this link into your browser:<br />
            <span style="color: #94a3b8;">${inviteUrl}</span>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: `Invitation to join ${workspaceName}`,
      html,
    });
  }

  async sendWorkspaceAccessGrantedEmail(email: string, workspaceName: string, role: string) {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 28px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 22px;">You've been added to ${workspaceName}</h1>
          <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px; line-height: 1.6;">
            Your existing account can now access this workspace.
          </p>
        </div>
        <div style="background: #111827; padding: 28px; border-radius: 0 0 12px 12px;">
          <div style="background: #0f172a; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; margin-bottom: 18px;">
            <p style="margin: 0; color: #cbd5e1; font-size: 13px;"><strong>Workspace:</strong> ${workspaceName}</p>
            <p style="margin: 8px 0 0; color: #cbd5e1; font-size: 13px;"><strong>Role:</strong> ${role}</p>
          </div>
          <a href="${this.appUrl('/login')}" style="display: inline-block; background: linear-gradient(135deg,#0ea5e9,#22d3ee); color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">Sign in</a>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: `You now have access to ${workspaceName}`,
      html,
    });
  }

  async sendVerificationEmail(email: string, name: string, token: string) {
    const verifyUrl = this.appUrl(`/verify-email?token=${token}`);
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 28px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 22px;">Verify your email</h1>
          <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px; line-height: 1.6;">
            Hi ${name}, confirm your email to finish setting up your account and continue into onboarding.
          </p>
        </div>
        <div style="background: #111827; padding: 28px; border-radius: 0 0 12px 12px;">
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg,#0ea5e9,#22d3ee); color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">Verify email</a>
          <p style="color: #64748b; font-size: 12px; margin: 18px 0 0; line-height: 1.6;">
            If the button does not work, copy this link into your browser:<br />
            <span style="color: #94a3b8;">${verifyUrl}</span>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html,
    });
  }
}
