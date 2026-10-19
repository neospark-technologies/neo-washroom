import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { ToiletId, ToiletStatus } from '@/types';
import { checkRateLimit } from '@/lib/utils/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent');

    // Rate limiting: 30 status changes per minute per IP
    const rateCheck = checkRateLimit(`status-change:${ip}`, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many status updates. Please wait ${rateCheck.resetInSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    const { toiletId, status } = body;

    if (!toiletId || (toiletId !== 'mens' && toiletId !== 'womens')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing toiletId. Allowed: "mens", "womens"' },
        { status: 400 }
      );
    }

    if (!status || !['available', 'occupied', 'maintenance'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing status. Allowed: "available", "occupied", "maintenance"',
        },
        { status: 400 }
      );
    }

    const result = await DatabaseService.updateToiletStatus(
      toiletId as ToiletId,
      status as ToiletStatus,
      ip,
      userAgent
    );

    return NextResponse.json({
      success: true,
      data: result.toilet,
      changed: result.changed,
      previousStatus: result.previousStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update toilet status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
