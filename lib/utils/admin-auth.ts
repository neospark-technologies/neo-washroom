import { NextRequest } from 'next/server';
import crypto from 'crypto';

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || 'neospark-admin-2026';
}

/**
 * Validates whether the incoming request contains the valid admin secret
 * via x-admin-secret header, Bearer token, or neo_admin_secret cookie.
 */
export function verifyAdminAccess(request: NextRequest): { authorized: boolean; reason?: string } {
  const configuredSecret = getAdminSecret();
  if (!configuredSecret) {
    return { authorized: false, reason: 'ADMIN_SECRET is not configured on the server' };
  }

  // 1. Check x-admin-secret header
  let secretCandidate = request.headers.get('x-admin-secret');

  // 2. Check Authorization Bearer header
  if (!secretCandidate) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      secretCandidate = authHeader.slice(7).trim();
    }
  }

  // 3. Check Cookie
  if (!secretCandidate) {
    const cookie = request.cookies.get('neo_admin_secret');
    if (cookie) {
      secretCandidate = cookie.value;
    }
  }

  if (!secretCandidate) {
    return { authorized: false, reason: 'Missing admin secret' };
  }

  try {
    const bufferA = Buffer.from(secretCandidate);
    const bufferB = Buffer.from(configuredSecret);

    if (bufferA.length !== bufferB.length) {
      return { authorized: false, reason: 'Invalid admin secret' };
    }

    const matches = crypto.timingSafeEqual(bufferA, bufferB);
    return matches ? { authorized: true } : { authorized: false, reason: 'Invalid admin secret' };
  } catch {
    return { authorized: false, reason: 'Verification error' };
  }
}

