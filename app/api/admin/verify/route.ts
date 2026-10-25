import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminSecret, verifyAdminAccess } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  const check = verifyAdminAccess(request);
  return NextResponse.json({
    success: true,
    authorized: check.authorized,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const candidate = body?.secret;

    if (!candidate || typeof candidate !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please enter the admin secret' },
        { status: 400 }
      );
    }

    const actual = getAdminSecret();
    const bufCandidate = Buffer.from(candidate);
    const bufActual = Buffer.from(actual);

    let isMatch = false;
    if (bufCandidate.length === bufActual.length) {
      isMatch = crypto.timingSafeEqual(bufCandidate, bufActual);
    }

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Incorrect admin secret' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Admin authorization verified',
    });

    // Set HTTP-only session cookie for smooth navigation within /admin
    response.cookies.set({
      name: 'neo_admin_secret',
      value: candidate,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication check failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Admin session cleared',
  });
  response.cookies.delete('neo_admin_secret');
  return response;
}
