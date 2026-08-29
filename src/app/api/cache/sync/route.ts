import { NextRequest, NextResponse } from 'next/server';
import { fetchPythonScraper } from '@/lib/python-api';

export async function POST(req: NextRequest) {
  try {
    const res = await fetchPythonScraper('/cache/sync', {
      method: 'POST',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger cache sync' },
      { status: 500 }
    );
  }
}
