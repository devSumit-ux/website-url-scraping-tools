import { NextRequest, NextResponse } from 'next/server';
import { fetchPythonScraper } from '@/lib/python-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const endpoint = format === 'csv' ? '/cache/export/csv' : '/cache/export';
    const res = await fetchPythonScraper(endpoint);

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
      { error: error instanceof Error ? error.message : 'Failed to export cache' },
      { status: 500 }
    );
  }
}
