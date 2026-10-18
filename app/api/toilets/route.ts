import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database';

export async function GET() {
  try {
    const toilets = await DatabaseService.getToiletsWithFreshness();
    return NextResponse.json(
      {
        success: true,
        data: toilets,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch toilets';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
