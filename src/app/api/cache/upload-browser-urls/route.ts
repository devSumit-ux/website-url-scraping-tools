import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${PYTHON_SCRAPER_URL}/cache/upload-browser-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload browser cache' },
      { status: 500 }
    );
  }
}
