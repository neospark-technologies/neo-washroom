import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { parseDeviceDetails } from '@/lib/utils/device';
import { PublicActivityEvent } from '@/types';
import { TOILETS } from '@/lib/constants';

export async function GET() {
  try {
    const rawHistory = await DatabaseService.getStatusHistory(25);

    const events: PublicActivityEvent[] = rawHistory.map((h) => {
      const details = parseDeviceDetails(h.user_agent);
      const toiletName =
        TOILETS[h.toilet_id]?.name ||
        (h.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet");

      let action = `Changed status to ${h.new_status}`;
      if (h.previous_status && h.previous_status !== h.new_status) {
        action = `Changed from ${h.previous_status} to ${h.new_status}`;
      } else if (h.previous_status === h.new_status) {
        action = `Re-verified status as ${h.new_status}`;
      }

      return {
        id: h.id,
        toilet_id: h.toilet_id,
        toilet_name: toiletName,
        previous_status: h.previous_status,
        new_status: h.new_status,
        action_summary: action,
        device_summary: details.summary,
        device_type: details.deviceType,
        os: details.os,
        browser: details.browser,
        created_at: h.created_at,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: events,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch activity log';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

