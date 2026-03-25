// notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(NotificationsService.name);
  private from: string;

  constructor(private config: ConfigService) {
    this.from = config.get('SMTP_FROM', 'noreply@opportunity-scanner.io');
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'localhost'),
      port: config.get('SMTP_PORT', 1025),
      secure: config.get('SMTP_SECURE', false),
      auth: config.get('SMTP_USER') ? {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      } : undefined,
    });
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
          <a href="${this.config.get('FRONTEND_URL', 'http://localhost:3000')}" style="display: inline-block; background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Open Dashboard</a>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({ from: this.from, to: recipients.join(','), subject, html });
    } catch (err) {
      this.logger.error('Failed to send alert email', err);
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; padding: 32px; border-radius: 8px;">
        <h1 style="color: #f8fafc; font-size: 22px;">Welcome to Internet Opportunity Scanner</h1>
        <p style="color: #94a3b8; line-height: 1.6;">Hi ${name}, your account is ready. Start by adding keywords to monitor and connecting your first source.</p>
        <a href="${this.config.get('FRONTEND_URL', 'http://localhost:3000')}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; margin-top: 16px;">Get Started</a>
      </div>
    `;
    try {
      await this.transporter.sendMail({ from: this.from, to: email, subject: 'Welcome to Internet Opportunity Scanner', html });
    } catch (err) {
      this.logger.error('Failed to send welcome email', err);
    }
  }
}
