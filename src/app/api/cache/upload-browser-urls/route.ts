import { NextRequest, NextResponse } from 'next/server';
import { fetchPythonScraper } from '@/lib/python-api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchPythonScraper('/cache/upload-browser-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
