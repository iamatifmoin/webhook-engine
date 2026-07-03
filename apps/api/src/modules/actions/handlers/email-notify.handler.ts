import { Injectable, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { getValueByPath } from '../../../common/utils/object-path';

@Injectable()
export class EmailNotifyHandler implements OnModuleInit {
  private transporter?: Transporter;

  async onModuleInit(): Promise<void> {
    this.transporter = await this.createTransporter();
  }

  async execute(
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<{ previewUrl: string | null }> {
    const transporter = this.transporter ?? (await this.createTransporter());
    this.transporter = transporter;

    const to = this.readRequiredString(config.to, 'Email notify requires a "to" address');
    const subject = this.readRequiredString(
      config.subject,
      'Email notify requires a "subject"',
    );
    const bodyTemplate = this.readRequiredString(
      config.bodyTemplate,
      'Email notify requires a "bodyTemplate"',
    );

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'debales@example.test',
      to,
      subject,
      text: this.renderTemplate(bodyTemplate, payload),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal preview URL: ${previewUrl}`);
    }

    return { previewUrl: previewUrl || null };
  }

  private async createTransporter(): Promise<Transporter> {
    const smtpUser = this.readOptionalString(process.env.SMTP_USER);
    const smtpPass = this.readOptionalString(process.env.SMTP_PASS);
    const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.ethereal.email';
    const smtpPort = Number(process.env.SMTP_PORT ?? 587);

    if (smtpUser && smtpPass) {
      console.log(`Using configured SMTP account ${smtpUser} on ${smtpHost}:${smtpPort}`);

      return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }

    const account = await nodemailer.createTestAccount();
    console.log(`Created Ethereal account user=${account.user} pass=${account.pass}`);

    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  }

  private renderTemplate(
    template: string,
    payload: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, token) => {
      const value = getValueByPath(payload, token.trim());
      return value === null || value === undefined ? '' : String(value);
    });
  }

  private readRequiredString(value: unknown, errorMessage: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    throw new Error(errorMessage);
  }

  private readOptionalString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }
}
