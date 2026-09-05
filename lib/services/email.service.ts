import nodemailer, { Transporter } from 'nodemailer';
import { EmailDeliveryStatus } from '@prisma/client';
import prisma from '../prisma';
import { SafeUser } from '../auth/types';
import { AuthorizationError, BusinessRuleError, NotFoundError, ValidationError } from '../errors';
import { PayslipPdfService } from '../payroll/payslip-pdf.service';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface BulkEmailResultItem {
  payslipId: string;
  employeeNumber: string;
  email: string | null;
  status: 'SENT' | 'FAILED';
  error?: string;
}

export interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  results: BulkEmailResultItem[];
}

export class EmailService {
  private static mockHandler: ((mail: EmailOptions) => Promise<any>) | null = null;

  /**
   * Sets or clears a mock transport for automated testing.
   * Prevents sending real emails or relying on external SMTP servers during test execution.
   */
  static setMockTransport(handler: ((mail: EmailOptions) => Promise<any>) | null) {
    this.mockHandler = handler;
  }

  /**
   * Checks if an email transport is configured via environment variables.
   */
  static isConfigured(): boolean {
    if (this.mockHandler) return true;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    return !!(host && port && user && pass);
  }

  /**
   * Core email sending utility.
   * Throws BusinessRuleError('EMAIL_NOT_CONFIGURED') if no transport is configured.
   * Never exposes credentials in errors or logs.
   */
  static async sendEmail(options: EmailOptions): Promise<{ messageId?: string; accepted: string[] }> {
    if (this.mockHandler) {
      const res = await this.mockHandler(options);
      return res || { accepted: [options.to] };
    }

    if (!this.isConfigured()) {
      throw new BusinessRuleError(
        'Email service is not configured. SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) are missing.',
        'EMAIL_NOT_CONFIGURED'
      );
    }

    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD!;
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'noreply@peoplepay360.com';

    const transporter: Transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? (info.accepted as string[]) : [options.to],
    };
  }

  /**
   * Sends an authoritative payslip email with attached frozen PDF.
   */
  static async sendPayslipEmail(payslipId: string, caller: SafeUser) {
    // 1. Authorization check
    const isAuthorized =
      caller.role.code === 'ADMIN' ||
      caller.permissions.includes('payroll.payrun.pay') ||
      caller.permissions.includes('payroll.payrun.read');

    if (!isAuthorized) {
      throw new AuthorizationError('You do not have permission to send payslip emails');
    }

    // 2. Load payslip with lines and employee
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
        employee: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!payslip) {
      throw new NotFoundError(`Payslip '${payslipId}' not found`);
    }

    // 3. Verify employee email exists
    const employeeEmail = payslip.employee?.email?.trim();
    if (!employeeEmail) {
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED },
      });
      throw new BusinessRuleError(
        `Employee '${payslip.employeeNameSnapshot}' (${payslip.employeeNumberSnapshot}) has no email address configured`,
        'EMPLOYEE_EMAIL_MISSING'
      );
    }

    // 4. Generate PDF from snapshot data
    const pdfBuffer = await PayslipPdfService.generatePayslipPdf(payslip);

    const periodStart = new Date(payslip.periodStartDate).toISOString().split('T')[0];
    const periodEnd = new Date(payslip.periodEndDate).toISOString().split('T')[0];
    const periodStr = `${periodStart} to ${periodEnd}`;

    // 5. Send email
    try {
      await this.sendEmail({
        to: employeeEmail,
        subject: `PeoplePay360 Payslip — ${periodStr}`,
        text: `Dear ${payslip.employeeNameSnapshot},\n\nPlease find attached your payslip (${payslip.payslipNumber}) for the period ${periodStr}.\n\nGross Salary: ₹ ${Number(payslip.grossSalary).toFixed(2)}\nTotal Deductions: ₹ ${Number(payslip.totalDeductions).toFixed(2)}\nNet Salary: ₹ ${Number(payslip.netSalary).toFixed(2)}\n\nThank you,\nPeoplePay360 Payroll Team`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #1E293B; line-height: 1.6;">
            <h2 style="color: #1E3A8A;">PeoplePay360 Payslip Notification</h2>
            <p>Dear <strong>${payslip.employeeNameSnapshot}</strong>,</p>
            <p>Your payslip <strong>${payslip.payslipNumber}</strong> for the pay period <strong>${periodStr}</strong> is attached.</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 16px 0;">
              <tr><td style="padding: 8px; border: 1px solid #CBD5E1;"><strong>Gross Salary</strong></td><td style="padding: 8px; border: 1px solid #CBD5E1; text-align: right;">₹ ${Number(payslip.grossSalary).toFixed(2)}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #CBD5E1;"><strong>Total Deductions</strong></td><td style="padding: 8px; border: 1px solid #CBD5E1; text-align: right;">₹ ${Number(payslip.totalDeductions).toFixed(2)}</td></tr>
              <tr style="background-color: #EFF6FF;"><td style="padding: 8px; border: 1px solid #1E3A8A; color: #1E3A8A;"><strong>Net Pay</strong></td><td style="padding: 8px; border: 1px solid #1E3A8A; color: #1E3A8A; font-weight: bold; text-align: right;">₹ ${Number(payslip.netSalary).toFixed(2)}</td></tr>
            </table>
            <p>Please review the attached PDF for full line-item details.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748B;">This is an automated message from PeoplePay360 HR. Please do not reply directly to this email.</p>
          </div>
        `,
        attachments: [
          {
            filename: `payslip-${payslip.payslipNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      // 6. Update delivery timestamp and status
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          emailSentAt: new Date(),
          emailDeliveryStatus: EmailDeliveryStatus.SENT,
          pdfGeneratedAt: new Date(),
        },
      });

      return {
        payslipId: payslip.id,
        employeeNumber: payslip.employeeNumberSnapshot,
        email: employeeEmail,
        status: 'SENT' as const,
      };
    } catch (err: any) {
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED },
      });
      throw err;
    }
  }

  /**
   * Sends payslip emails to all employees in a payrun in bulk.
   * Captures individual per-payslip success/failure results.
   * Single failed email does NOT mark the entire run as failed.
   */
  static async sendBulkPayrunEmails(payrunId: string, caller: SafeUser): Promise<BulkEmailResult> {
    const isAuthorized =
      caller.role.code === 'ADMIN' ||
      caller.permissions.includes('payroll.payrun.pay') ||
      caller.permissions.includes('payroll.payrun.read');

    if (!isAuthorized) {
      throw new AuthorizationError('You do not have permission to send bulk payslip emails');
    }

    const payrun = await prisma.payrun.findUnique({
      where: { id: payrunId },
      include: {
        payslips: {
          include: {
            lines: { orderBy: { sequence: 'asc' } },
            employee: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!payrun) {
      throw new NotFoundError(`Payrun '${payrunId}' not found`);
    }

    let sent = 0;
    let failed = 0;
    const results: BulkEmailResultItem[] = [];

    for (const payslip of payrun.payslips) {
      const empEmail = payslip.employee?.email?.trim();
      if (!empEmail) {
        await prisma.payslip.update({
          where: { id: payslip.id },
          data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED },
        });
        results.push({
          payslipId: payslip.id,
          employeeNumber: payslip.employeeNumberSnapshot,
          email: null,
          status: 'FAILED',
          error: 'Employee has no email address configured',
        });
        failed++;
        continue;
      }

      try {
        const pdfBuffer = await PayslipPdfService.generatePayslipPdf(payslip);
        const periodStart = new Date(payslip.periodStartDate).toISOString().split('T')[0];
        const periodEnd = new Date(payslip.periodEndDate).toISOString().split('T')[0];
        const periodStr = `${periodStart} to ${periodEnd}`;

        await this.sendEmail({
          to: empEmail,
          subject: `PeoplePay360 Payslip — ${periodStr}`,
          text: `Dear ${payslip.employeeNameSnapshot},\n\nPlease find attached your payslip (${payslip.payslipNumber}) for the period ${periodStr}.\n\nNet Pay: ₹ ${Number(payslip.netSalary).toFixed(2)}\n\nThank you,\nPeoplePay360 Payroll Team`,
          attachments: [
            {
              filename: `payslip-${payslip.payslipNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });

        await prisma.payslip.update({
          where: { id: payslip.id },
          data: {
            emailSentAt: new Date(),
            emailDeliveryStatus: EmailDeliveryStatus.SENT,
            pdfGeneratedAt: new Date(),
          },
        });

        results.push({
          payslipId: payslip.id,
          employeeNumber: payslip.employeeNumberSnapshot,
          email: empEmail,
          status: 'SENT',
        });
        sent++;
      } catch (err: any) {
        await prisma.payslip.update({
          where: { id: payslip.id },
          data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED },
        });
        results.push({
          payslipId: payslip.id,
          employeeNumber: payslip.employeeNumberSnapshot,
          email: empEmail,
          status: 'FAILED',
          error: err.message,
        });
        failed++;
      }
    }

    // Update aggregate email count on payrun
    if (sent > 0) {
      await prisma.payrun.update({
        where: { id: payrunId },
        data: {
          emailsSentCount: { increment: sent },
          emailsSentAt: new Date(),
        },
      });
    }

    return {
      total: payrun.payslips.length,
      sent,
      failed,
      results,
    };
  }
}
