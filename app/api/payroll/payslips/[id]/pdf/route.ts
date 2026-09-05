import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { PayslipPdfService } from '@/lib/payroll/payslip-pdf.service';
import { jsonError } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Authorization & fetching is verified strictly by PayrunService.getPayslipById
    const payslip = await PayrunService.getPayslipById(id, user);

    // Generate authoritative PDF from snapshot data
    const pdfBuffer = await PayslipPdfService.generatePayslipPdf(payslip);

    // Record generation timestamp
    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { pdfGeneratedAt: new Date() },
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payslip-${payslip.payslipNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
