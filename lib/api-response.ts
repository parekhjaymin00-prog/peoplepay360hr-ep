import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { ZodError } from 'zod';

export function jsonSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status, headers }
  );
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const formatted = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: formatted,
        },
      },
      { status: 400 }
    );
  }

  console.error('Unhandled API error:', error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    },
    { status: 500 }
  );
}
