import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { SupplyCategory, SupplySeverity, SupplyStatus, ToiletId } from '@/types';
import { SUPPLY_CATEGORIES, SUPPLY_SEVERITIES } from '@/lib/constants';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import { verifyAdminAccess } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unresolvedOnly = searchParams.get('unresolvedOnly') === 'true';
    const toiletId = searchParams.get('toiletId') as ToiletId | null;
    const category = searchParams.get('category') as SupplyCategory | null;
    const severity = searchParams.get('severity') as SupplySeverity | null;
    const status = searchParams.get('status') as SupplyStatus | null;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const adminCheck = verifyAdminAccess(request);
    const isAdmin = adminCheck.authorized;

    const reports = await DatabaseService.getSupplyReports({
      unresolvedOnly: !isAdmin && !searchParams.has('unresolvedOnly') ? true : unresolvedOnly,
      toiletId: toiletId || undefined,
      category: category || undefined,
      severity: severity || undefined,
      status: status || undefined,
      includeArchived: isAdmin ? includeArchived : false,
    });

    // Public view must NOT expose IP addresses or internal technical details
    const sanitized = reports.map((r) => ({
      id: r.id,
      toilet_id: r.toilet_id,
      toilet_name: r.toilet_name,
      category: r.category,
      description: r.description,
      severity: r.severity,
      status: r.status,
      resolution_note: r.resolution_note,
      is_archived: r.is_archived,
      created_at: r.created_at,
      updated_at: r.updated_at,
      resolved_at: r.resolved_at,
      ...(isAdmin ? { ip_address: r.ip_address } : {}),
    }));

    return NextResponse.json({
      success: true,
      data: sanitized,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch supply reports';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // Rate limiting: 5 reports per minute per IP
    const rateCheck = checkRateLimit(`supply-report:${ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many submissions. Please wait ${rateCheck.resetInSeconds} seconds before submitting again.`,
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

    const { toilet_id, category, description, severity } = body;

    // Server-side validation
    if (!toilet_id || (toilet_id !== 'mens' && toilet_id !== 'womens')) {
      return NextResponse.json(
        { success: false, error: 'Please select a valid toilet (Men\'s or Women\'s)' },
        { status: 400 }
      );
    }

    if (!category || !SUPPLY_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid supply category. Allowed: ${SUPPLY_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (severity && !SUPPLY_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: 'Invalid severity. Allowed: Normal, Urgent' },
        { status: 400 }
      );
    }

    const descStr = typeof description === 'string' ? description.trim() : '';
    if (descStr.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Description must be 500 characters or less' },
        { status: 400 }
      );
    }

    // Public users cannot set status: it always defaults to 'pending'
    const newReport = await DatabaseService.createSupplyReport({
      toilet_id,
      category,
      description: descStr || null,
      severity: severity || 'Normal',
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newReport.id,
          toilet_id: newReport.toilet_id,
          toilet_name: newReport.toilet_name,
          category: newReport.category,
          description: newReport.description,
          severity: newReport.severity,
          status: newReport.status,
          created_at: newReport.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit supply report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
