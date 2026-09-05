import PDFDocument from 'pdfkit';
import { Payslip, PayslipLine } from '@prisma/client';
import prisma from '../prisma';

export type PayslipWithLines = Payslip & {
  lines: PayslipLine[];
};

export class PayslipPdfService {
  /**
   * Generates a professional, authoritative payslip PDF strictly from frozen snapshot data.
   * NEVER recalculates or mutates financial figures during document generation.
   */
  static async generatePayslipPdf(payslip: PayslipWithLines): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          compress: false, // Uncompressed streams ensure deterministic inspection & verification
          info: {
            Title: `Payslip - ${payslip.payslipNumber}`,
            Author: 'PeoplePay360 HR & Payroll Engine',
            Subject: `Salary Payslip for ${payslip.employeeNameSnapshot} (${payslip.employeeNumberSnapshot})`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const primaryColor = '#1E3A8A'; // Deep navy
        const secondaryColor = '#475569'; // Slate
        const tableHeaderBg = '#F1F5F9';
        const borderColor = '#CBD5E1';

        // --------------------------------------------------------------------
        // HEADER
        // --------------------------------------------------------------------
        doc.rect(40, 40, 515, 65).fill('#F8FAFC');
        doc.rect(40, 40, 515, 65).stroke(borderColor);

        doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('PEOPLEPAY360', 55, 52);
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica').text('ENTERPRISE HR & PAYROLL PLATFORM', 55, 76);

        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('SALARY PAYSLIP', 400, 52, { align: 'right', width: 140 });
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica').text(`Ref: ${payslip.payslipNumber}`, 400, 72, { align: 'right', width: 140 });
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica').text(`Status: ${payslip.status}`, 400, 85, { align: 'right', width: 140 });

        let currentY = 120;

        // --------------------------------------------------------------------
        // SECTION 1: EMPLOYEE & CONTRACT INFORMATION
        // --------------------------------------------------------------------
        const boxWidth = 250;
        const boxHeight = 90;

        // Left Box: Employee Details
        doc.rect(40, currentY, boxWidth, boxHeight).fill('#FAFAFA').stroke(borderColor);
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('EMPLOYEE DETAILS', 50, currentY + 8);
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(50, currentY + 22).lineTo(40 + boxWidth - 10, currentY + 22).stroke();

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(secondaryColor);
        doc.text('Name:', 50, currentY + 30);
        doc.text('Employee No:', 50, currentY + 44);
        doc.text('Department:', 50, currentY + 58);
        doc.text('Designation:', 50, currentY + 72);

        doc.font('Helvetica').fillColor('#0F172A');
        doc.text(payslip.employeeNameSnapshot, 125, currentY + 30);
        doc.text(payslip.employeeNumberSnapshot, 125, currentY + 44);
        doc.text(payslip.departmentNameSnapshot, 125, currentY + 58);
        doc.text(payslip.jobPositionNameSnapshot, 125, currentY + 72);

        // Right Box: Contract & Period Details
        const rightBoxX = 305;
        doc.rect(rightBoxX, currentY, boxWidth, boxHeight).fill('#FAFAFA').stroke(borderColor);
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('PAYROLL & CONTRACT', rightBoxX + 10, currentY + 8);
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(rightBoxX + 10, currentY + 22).lineTo(rightBoxX + boxWidth - 10, currentY + 22).stroke();

        const periodStartStr = new Date(payslip.periodStartDate).toISOString().split('T')[0];
        const periodEndStr = new Date(payslip.periodEndDate).toISOString().split('T')[0];

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(secondaryColor);
        doc.text('Contract No:', rightBoxX + 10, currentY + 30);
        doc.text('Wage Type:', rightBoxX + 10, currentY + 44);
        doc.text('Pay Period:', rightBoxX + 10, currentY + 58);
        doc.text('Structure:', rightBoxX + 10, currentY + 72);

        doc.font('Helvetica').fillColor('#0F172A');
        doc.text(payslip.contractNumberSnapshot, rightBoxX + 80, currentY + 30);
        doc.text(payslip.contractWageTypeSnapshot, rightBoxX + 80, currentY + 44);
        doc.text(`${periodStartStr} to ${periodEndStr}`, rightBoxX + 80, currentY + 58);
        doc.text(payslip.salaryStructureNameSnapshot, rightBoxX + 80, currentY + 72);

        currentY += boxHeight + 12;

        // --------------------------------------------------------------------
        // SECTION 2: ATTENDANCE & TIME SUMMARY
        // --------------------------------------------------------------------
        doc.rect(40, currentY, 515, 45).fill('#F1F5F9').stroke(borderColor);
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('ATTENDANCE & TIME SUMMARY', 50, currentY + 6);

        const colW = 62;
        const metricsY = currentY + 20;

        const metrics = [
          { label: 'Sched. Days', val: Number(payslip.scheduledWorkingDays).toFixed(1) },
          { label: 'Worked Days', val: Number(payslip.actualWorkedDays).toFixed(1) },
          { label: 'Worked Hours', val: Number(payslip.workedHours).toFixed(1) },
          { label: 'Expected Hrs', val: Number(payslip.expectedHours).toFixed(1) },
          { label: 'Overtime Hrs', val: Number(payslip.overtimeHours).toFixed(1) },
          { label: 'Paid Leave', val: Number(payslip.paidLeaveQuantity).toFixed(1) },
          { label: 'Unpaid Leave', val: Number(payslip.unpaidLeaveQuantity).toFixed(1) },
          { label: 'Absent Days', val: Number(payslip.absentDays).toFixed(1) },
        ];

        metrics.forEach((m, idx) => {
          const x = 50 + idx * colW;
          doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica').text(m.label, x, metricsY);
          doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text(m.val, x, metricsY + 11);
        });

        currentY += 58;

        // --------------------------------------------------------------------
        // SECTION 3: SALARY BREAKDOWN / PAYSLIP LINES TABLE
        // --------------------------------------------------------------------
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('EARNINGS & DEDUCTIONS BREAKDOWN', 40, currentY);
        currentY += 14;

        // Table Header
        doc.rect(40, currentY, 515, 20).fill(tableHeaderBg).stroke(borderColor);
        doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold');
        doc.text('CODE', 48, currentY + 6, { width: 60 });
        doc.text('DESCRIPTION', 110, currentY + 6, { width: 170 });
        doc.text('CATEGORY', 285, currentY + 6, { width: 90 });
        doc.text('RATE / BASE', 380, currentY + 6, { width: 75, align: 'right' });
        doc.text('AMOUNT (INR)', 465, currentY + 6, { width: 80, align: 'right' });

        currentY += 20;

        // Sort lines by sequence ascending
        const sortedLines = [...payslip.lines].sort((a, b) => a.sequence - b.sequence);

        doc.font('Helvetica').fontSize(8);
        for (const line of sortedLines) {
          // Zebra striping
          doc.rect(40, currentY, 515, 18).stroke(borderColor);

          doc.fillColor('#0F172A').text(line.ruleCode, 48, currentY + 5, { width: 60 });
          doc.text(line.ruleName, 110, currentY + 5, { width: 170 });

          // Category color accent
          let catColor = '#334155';
          if (line.category === 'BASIC' || line.category === 'ALLOWANCE' || line.category === 'GROSS') {
            catColor = '#15803D'; // Greenish
          } else if (line.category === 'DEDUCTION') {
            catColor = '#B91C1C'; // Reddish
          } else if (line.category === 'COMPANY_CONTRIBUTION') {
            catColor = '#4338CA'; // Indigo
          }
          doc.fillColor(catColor).font('Helvetica-Bold').text(line.category, 285, currentY + 5, { width: 90 });

          doc.font('Helvetica').fillColor('#475569');
          const rateBaseStr = line.rate
            ? `${Number(line.rate).toFixed(2)}%`
            : line.baseAmount
            ? Number(line.baseAmount).toFixed(2)
            : '-';
          doc.text(rateBaseStr, 380, currentY + 5, { width: 75, align: 'right' });

          doc.fillColor('#0F172A').font('Helvetica-Bold');
          doc.text(Number(line.amount).toFixed(2), 465, currentY + 5, { width: 80, align: 'right' });

          currentY += 18;

          // Page overflow check
          if (currentY > 680) {
            doc.addPage();
            currentY = 40;
          }
        }

        currentY += 12;

        // --------------------------------------------------------------------
        // SECTION 4: FINANCIAL TOTALS SUMMARY
        // --------------------------------------------------------------------
        const summaryBoxY = currentY;
        const leftSummaryWidth = 260;
        const rightSummaryWidth = 245;

        // Left: Totals breakdown
        doc.rect(40, summaryBoxY, leftSummaryWidth, 75).fill('#FAFAFA').stroke(borderColor);
        doc.fillColor(secondaryColor).fontSize(8.5).font('Helvetica');
        doc.text('Basic Salary:', 50, summaryBoxY + 8);
        doc.text('Gross Earnings:', 50, summaryBoxY + 24);
        doc.text('Total Deductions:', 50, summaryBoxY + 40);
        doc.text('Employer Contributions:', 50, summaryBoxY + 56);

        doc.fillColor('#0F172A').font('Helvetica-Bold');
        doc.text(Number(payslip.basicSalary).toFixed(2), 190, summaryBoxY + 8, { width: 100, align: 'right' });
        doc.text(Number(payslip.grossSalary).toFixed(2), 190, summaryBoxY + 24, { width: 100, align: 'right' });
        doc.text(Number(payslip.totalDeductions).toFixed(2), 190, summaryBoxY + 40, { width: 100, align: 'right' });
        const employerContributions = Math.max(0, Number(payslip.totalEmployerCost) - Number(payslip.grossSalary));
        doc.text(employerContributions.toFixed(2), 190, summaryBoxY + 56, { width: 100, align: 'right' });

        // Right: NET PAY (Highlighted Card)
        doc.rect(310, summaryBoxY, rightSummaryWidth, 75).fill('#EFF6FF').stroke(primaryColor);
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('NET TAKE-HOME PAY', 320, summaryBoxY + 12);
        doc.fillColor('#1E3A8A').fontSize(22).font('Helvetica-Bold').text(`₹ ${Number(payslip.netSalary).toFixed(2)}`, 320, summaryBoxY + 28);
        doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text(`Total CTC / Cost to Company: ₹ ${Number(payslip.totalEmployerCost).toFixed(2)}`, 320, summaryBoxY + 56);

        currentY += 92;

        // --------------------------------------------------------------------
        // FOOTER / DISCLAIMER
        // --------------------------------------------------------------------
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
        doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica').text(
          'This is a system-generated document produced by the PeoplePay360 HR & Payroll Engine and requires no physical signature.',
          40,
          currentY + 6,
          { align: 'center', width: 515 }
        );
        doc.text(
          'Confidential. The contents of this document are intended strictly for the named employee.',
          40,
          currentY + 16,
          { align: 'center', width: 515 }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates and registers PDF for a payslip, stamping pdfGeneratedAt.
   */
  static async getOrGeneratePayslipPdf(payslipId: string): Promise<{ buffer: Buffer; payslip: PayslipWithLines }> {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!payslip) {
      throw new Error(`Payslip '${payslipId}' not found`);
    }

    const buffer = await this.generatePayslipPdf(payslip);

    // Update timestamp
    await prisma.payslip.update({
      where: { id: payslipId },
      data: { pdfGeneratedAt: new Date() },
    });

    return { buffer, payslip };
  }
}
