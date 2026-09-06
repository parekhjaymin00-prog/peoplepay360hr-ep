import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend proxy for /api/employees
 * Forwards requests to backend with authentication
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const { searchParams } = new URL(request.url);
    
    const backendResponse = await fetch(`${backendUrl}/api/employees?${searchParams.toString()}`, {
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
    console.error('Employees GET proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    const backendResponse = await fetch(`${backendUrl}/api/employees`, {
      method: 'POST',
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
    console.error('Employees POST proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to create employee' },
      { status: 500 }
    );
  }
}
