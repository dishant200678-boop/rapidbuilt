import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export class EmailService {
  static async sendEarlyWarningEmail(
    to: string,
    projectTitle: string,
    riskScore: number,
    reason: string
  ): Promise<void> {
    if (!transporter) {
      logger.info(
        `[Email Mock] Early warning alert for "${projectTitle}" (Risk: ${riskScore}) logged (SMTP not configured)`
      );
      return;
    }

    if (env.NODE_ENV === 'production') {
      try {
        await transporter.sendMail({
          from: env.EMAIL_FROM,
          to,
          subject: `🚨 CRITICAL EARLY WARNING: ${projectTitle} (Risk: ${riskScore}/100)`,
          text: `Urgent Project Monitoring Alert:\n\nProject: ${projectTitle}\nRisk Score: ${riskScore}/100\nReason: ${reason}\n\nPlease access the National Project Monitoring Portal immediately.`,
        });

        logger.info(`Early warning email dispatched to ${to}`);
      } catch (error) {
        logger.error('Failed to dispatch early warning email:', error);
      }
    } else {
      logger.info(
        `Early warning email skipped in ${env.NODE_ENV} environment`
      );
    }
  }
}