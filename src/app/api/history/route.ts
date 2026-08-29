import { NextResponse } from 'next/server';
import { fetchPythonScraper } from '@/lib/python-api';

export async function GET() {
  try {
    const res = await fetchPythonScraper('/history/stats', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return NextResponse.json({ total_unique: 0, total_urls: 0 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ total_unique: 0, total_urls: 0 });
  }
}

export async function POST() {
  try {
    const res = await fetchPythonScraper('/history/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'error', total_unique: 0 }, { status: 500 });
  }
}
