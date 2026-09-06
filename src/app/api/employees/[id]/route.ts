import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend proxy for /api/employees/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    const backendResponse = await fetch(`${backendUrl}/api/employees/${id}`, {
      method: 'GET',
      headers: {
        'Cookie': `token=${token.value}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error('Employee GET proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to fetch employee' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    const backendResponse = await fetch(`${backendUrl}/api/employees/${id}`, {
      method: 'PATCH',
      headers: {
        'Cookie': `token=${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error('Employee PATCH proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to update employee' },
      { status: 500 }
    );
  }
}
