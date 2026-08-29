import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${PYTHON_SCRAPER_URL}/cache/stats`, {
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        total_unique_approved: 0,
        total_filtered_domains: 0,
        cloud_connected: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cache stats',
      },
      { status: 500 }
    );
  }
}
