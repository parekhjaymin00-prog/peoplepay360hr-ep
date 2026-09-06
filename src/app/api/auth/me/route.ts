import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend /api/auth/me proxy route.
 * Forwards request to backend with 'token' cookie to verify session.
 * Returns authenticated user with role and permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token');
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Forward request to backend with token cookie
    const backendResponse = await fetch(`${backendUrl}/api/auth/me`, {
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
    console.error('/api/auth/me proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to verify session' },
      { status: 500 }
    );
  }
}
