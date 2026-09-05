import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthService } from '@/lib/services/auth.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const session = await AuthService.login(email, password);

    // Set secure HTTP-only cookie in response
    const response = jsonSuccess(session);
    response.cookies.set({
      name: 'token',
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
