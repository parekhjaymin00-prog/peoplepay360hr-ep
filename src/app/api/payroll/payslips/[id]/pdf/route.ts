import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getAuthHeaders } from "@/lib/api/proxy-helper";

/**
 * PDF download - needs special handling to stream binary content
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const backendUrl = getBackendUrl();
    const url = `${backendUrl}/api/payroll/payslips/${id}/pdf`;

    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(token.value),
      credentials: 'include',
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    // Stream the PDF binary content
    const pdfBuffer = await backendResponse.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payslip-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error(`PDF download error for payslip ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Unable to download PDF' },
      { status: 500 }
    );
  }
}