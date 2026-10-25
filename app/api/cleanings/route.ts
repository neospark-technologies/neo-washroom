import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { ToiletId } from '@/types';

export async function GET() {
  try {
    const [schedules, logs] = await Promise.all([
      DatabaseService.getCleaningSchedules(),
      DatabaseService.getCleaningLogs(30),
    ]);

    return NextResponse.json({
      success: true,
      data: { schedules, logs },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch cleaning records';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { toilet_id, checklist, notes, staff_identifier } = body;

    if (!toilet_id || (toilet_id !== 'mens' && toilet_id !== 'womens')) {
      return NextResponse.json(
        { success: false, error: 'Valid toilet_id ("mens" or "womens") is required' },
        { status: 400 }
      );
    }

    const log = await DatabaseService.createCleaningLog({
      toilet_id: toilet_id as ToiletId,
      checklist: Array.isArray(checklist) ? checklist : undefined,
      notes: typeof notes === 'string' ? notes.trim() : null,
      staff_identifier: typeof staff_identifier === 'string' ? staff_identifier.trim() : null,
    });

    return NextResponse.json({
      success: true,
      data: log,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record cleaning log';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
