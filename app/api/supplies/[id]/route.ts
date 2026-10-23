import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { verifyAdminAccess } from '@/lib/utils/admin-auth';
import { SUPPLY_STATUSES } from '@/lib/constants';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminAuth = verifyAdminAccess(request);
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { success: false, error: adminAuth.reason || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing report ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { status, resolution_note, is_archived } = body;

    if (status && !SUPPLY_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Allowed: ${SUPPLY_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const adminIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    const updated = await DatabaseService.updateSupplyReport(
      id,
      {
        status,
        resolution_note: typeof resolution_note === 'string' ? resolution_note.trim() : undefined,
        is_archived: typeof is_archived === 'boolean' ? is_archived : undefined,
      },
      adminIp
    );

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update supply report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminAuth = verifyAdminAccess(request);
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { success: false, error: adminAuth.reason || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing report ID' }, { status: 400 });
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const adminIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    await DatabaseService.deleteSupplyReport(id, adminIp);

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete supply report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
