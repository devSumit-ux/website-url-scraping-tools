import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob } from '@/lib/job-store';
import { SearchRequest } from '@/lib/types';
import { fetchPythonScraper } from '@/lib/python-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchRequest = body as SearchRequest;
    const requestedLimit = Math.min(searchRequest.limit || 1000, 100000);
    const job = createJob(searchRequest);
    
    updateJob(job.id, {
      status: 'searching',
      startedAt: new Date().toISOString(),
      candidates: 0,
      processed: 0,
      accepted: 0,
    });

    const pyRes = await fetchPythonScraper('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        query: searchRequest.query || '',
        limit: requestedLimit,
        time_frame: searchRequest.timeFrame && searchRequest.timeFrame !== 'all' ? searchRequest.timeFrame : undefined,
        country: searchRequest.region || undefined,
        area: searchRequest.area || undefined,
        tld: searchRequest.tld || undefined,
        include_domains: searchRequest.includeDomains,
        exclude_domains: searchRequest.excludeDomains,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text().catch(() => 'Scraper engine rejected request');
      updateJob(job.id, { status: 'failed', error: errText });
      return NextResponse.json({ error: `Python engine error: ${errText}` }, { status: 502 });
    }

    return NextResponse.json({ jobId: job.id, searchId: job.id, status: 'searching' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start search job' },
      { status: 500 }
    );
  }
}
