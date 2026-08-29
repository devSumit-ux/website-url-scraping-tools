import { NextRequest, NextResponse } from 'next/server';
import { fetchPythonScraper } from '@/lib/python-api';

export async function GET(req: NextRequest) {
  try {
    const res = await fetchPythonScraper('/cache/stats');
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
