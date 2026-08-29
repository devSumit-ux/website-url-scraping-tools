import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const res = await fetch(`${PYTHON_SCRAPER_URL}/cache/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync cache to MongoDB' },
      { status: 500 }
    );
  }
}
