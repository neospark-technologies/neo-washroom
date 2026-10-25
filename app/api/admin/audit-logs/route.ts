import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { verifyAdminAccess } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const adminAuth = verifyAdminAccess(request);
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { success: false, error: adminAuth.reason || 'Unauthorized' },
        { status: 401 }
      );
    }

    const [statusHistory, adminAuditLogs] = await Promise.all([
      DatabaseService.getStatusHistory(50),
      DatabaseService.getAdminAuditLogs(50),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        statusHistory,
        adminAuditLogs,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
