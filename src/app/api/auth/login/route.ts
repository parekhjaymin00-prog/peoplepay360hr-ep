import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend login proxy route.
 * This route forwards authentication to the real backend and returns the response.
 * Backend sets 'token' cookie with JWT.
 * 
 * NOTE: This is a proxy layer. In production, consider:
 * - Pointing frontend API client directly to backend
 * - Or using Next.js rewrites to proxy /api/* to backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get backend URL from environment or default to localhost:3001
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Forward request to real backend
    const backendResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include', // Important: include cookies
    });

    const data = await backendResponse.json();

    // Extract token cookie from backend response and set it on frontend response
    const backendCookies = backendResponse.headers.get('set-cookie');
    const response = NextResponse.json(data, { status: backendResponse.status });
    
    // Forward the token cookie from backend
    if (backendCookies) {
      const tokenMatch = backendCookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        response.cookies.set({
          name: 'token',
          value: tokenMatch[1],
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 8 * 60 * 60, // 8 hours (matching backend)
        });
      }
    }

    return response;
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to connect to authentication service' },
      { status: 500 }
    );
  }
}
