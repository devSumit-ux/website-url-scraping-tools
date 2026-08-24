import { NextRequest, NextResponse } from 'next/server';
import { getJob, addJobResults } from '@/lib/job-store';

function formatProperUrl(urlOrDomain: string): string {
  if (!urlOrDomain) return '';
  let d = urlOrDomain.trim().toLowerCase();
  if (d.includes('://')) {
    d = d.split('://')[1];
  }
  d = d.split('/')[0].split('?')[0].split('#')[0];
  while (d.startsWith('www.')) {
    d = d.slice(4);
  }
  return `https://www.${d}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = getJob(id);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 100000, 100000);
    const offset = Number(searchParams.get('offset')) || 0;

    let resultsList = job?.results || [];

    // If memory store doesn't have results yet, fetch directly from Python backend
    if (resultsList.length === 0) {
      try {
        const pyRes = await fetch(`http://localhost:8000/results/${id}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
        if (pyRes.ok) {
          const pyData = await pyRes.json();
          const rawResults = pyData.results || [];
          resultsList = rawResults.map((r: any) => ({
            id: crypto.randomUUID(),
            title: r.title || r.domain,
            url: formatProperUrl(r.url || r.domain),
            domain: r.domain,
            description: r.description,
            publishedAt: r.published_at,
            modifiedAt: r.modified_at,
            dateConfidence: 'low',
            contentType: r.content_type || 'webpage',
            safetyStatus: 'safe',
            rank: 0,
            relevanceScore: Math.round(r.relevance_score || 0),
          }));
          if (job) {
            addJobResults(job.id, resultsList);
          }
        }
      } catch {}
    }

    const results = resultsList.slice(offset, offset + limit);

    return NextResponse.json({
      results,
      total: resultsList.length,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
