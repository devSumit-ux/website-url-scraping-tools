import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const endpoint = format === 'csv' ? `${PYTHON_SCRAPER_URL}/cache/export/csv` : `${PYTHON_SCRAPER_URL}/cache/export`;
    const res = await fetch(endpoint, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch cache export from engine' }, { status: res.status });
    }

    const contentType = res.headers.get('Content-Type') || (format === 'csv' ? 'text/csv' : 'application/json');
    const contentDisposition = res.headers.get('Content-Disposition') || (format === 'csv' ? 'attachment; filename="webscope_scraped_urls.csv"' : 'attachment; filename="webscope_cache_export.json"');

    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown export error' },
      { status: 500 }
    );
  }
}
