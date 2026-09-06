import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend logout proxy route.
 * Forwards logout request to backend and clears token cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token');
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Forward logout to backend
    if (token) {
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Cookie': `token=${token.value}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    }

    // Clear token cookie on frontend
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('Logout proxy error:', error);
    // Even if backend call fails, clear local cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  }
}
