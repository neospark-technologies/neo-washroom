import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { ToiletId } from '@/types';
import { checkRateLimit } from '@/lib/utils/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent');

    // Rate limiting: 60 queue updates per minute per IP
    const rateCheck = checkRateLimit(`queue-update:${ip}`, 60, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many queue updates. Please wait ${rateCheck.resetInSeconds} seconds.`,
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

    const { toiletId, delta, action } = body;

    if (!toiletId || (toiletId !== 'mens' && toiletId !== 'womens')) {
      return NextResponse.json(
        { success: false, error: 'Invalid toiletId. Allowed: "mens", "womens"' },
        { status: 400 }
      );
    }

    let numericDelta = 0;
    if (typeof delta === 'number') {
      numericDelta = delta > 0 ? 1 : -1;
    } else if (action === 'increment') {
      numericDelta = 1;
    } else if (action === 'decrement') {
      numericDelta = -1;
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide delta (+1 or -1) or action ("increment" or "decrement")' },
        { status: 400 }
      );
    }

    const updatedToilet = await DatabaseService.updateToiletQueue(
      toiletId as ToiletId,
      numericDelta,
      ip,
      userAgent
    );

    return NextResponse.json({
      success: true,
      data: updatedToilet,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update queue';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

