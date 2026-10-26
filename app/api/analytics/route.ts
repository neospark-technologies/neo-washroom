import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';
import { AnalyticsPeriod } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || 'today';

    if (!['today', '7d', '30d'].includes(periodParam)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Allowed: "today", "7d", "30d"' },
        { status: 400 }
      );
    }

    const analytics = await DatabaseService.getAnalyticsData(periodParam as AnalyticsPeriod);

    return NextResponse.json(
      {
        success: true,
        data: analytics,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate analytics';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
