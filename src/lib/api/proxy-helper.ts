import { NextRequest, NextResponse } from 'next/server';

/**
 * Generic backend proxy helper
 * Forwards requests to backend with token authentication
 */

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
}

export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Cookie': `token=${token}`,
    'Content-Type': 'application/json',
  };
}

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  method: string = 'GET',
  body?: unknown
): Promise<NextResponse> {
  try {
    const token = request.cookies.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const backendUrl = getBackendUrl();
    const url = `${backendUrl}${backendPath}`;

    const options: RequestInit = {
      method,
      headers: getAuthHeaders(token.value),
      credentials: 'include',
    };

    if (body !== undefined && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const backendResponse = await fetch(url, options);
    const data = await backendResponse.json();
    
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error(`Proxy error for ${backendPath}:`, error);
    return NextResponse.json(
      { success: false, error: 'Unable to complete request' },
      { status: 500 }
    );
  }
}
