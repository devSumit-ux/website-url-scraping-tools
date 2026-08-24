import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob } from '@/lib/job-store';
import { SearchRequest } from '@/lib/types';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

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

    try {
      await fetch(`${PYTHON_SCRAPER_URL}/search`, {
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
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.warn('Backend trigger notice:', e);
    }

    return NextResponse.json({ jobId: job.id, searchId: job.id, status: 'searching' });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
