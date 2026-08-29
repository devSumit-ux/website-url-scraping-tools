import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/job-store';
import { fetchPythonScraper } from '@/lib/python-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = getJob(id);

    let currentStatus = job?.status || 'searching';
    let candidates = job?.candidates || 0;
    let processed = job?.processed || 0;
    let accepted = job?.accepted || 0;
    let etaSeconds: number | null = null;
    let rate = 0;
    let error = job?.error;

    try {
      const pyRes = await fetchPythonScraper(`/progress/${id}`);
      if (pyRes.ok) {
        const pyData = await pyRes.json();
        if (pyData.candidates !== undefined) candidates = Math.max(candidates, pyData.candidates);
        if (pyData.processed !== undefined) processed = Math.max(processed, pyData.processed);
        if (pyData.accepted !== undefined) accepted = Math.max(accepted, pyData.accepted);
        if (pyData.eta_seconds !== undefined) etaSeconds = pyData.eta_seconds;
        if (pyData.rate !== undefined) rate = pyData.rate;
        if (pyData.error) error = pyData.error;
        if (pyData.status) {
          currentStatus = pyData.status;
          if (job) {
            updateJob(job.id, {
              status: pyData.status,
              candidates,
              processed,
              accepted,
              error,
              completedAt: pyData.status === 'completed' || pyData.status === 'failed' ? new Date().toISOString() : undefined,
            });
          }
        }
      }
    } catch {}

    if (!job && currentStatus === 'not_found') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id,
      status: currentStatus,
      requested: (job?.accepted || 0) + (job?.blocked || 0) + (job?.duplicates || 0) + (job?.failed || 0),
      candidates,
      processed,
      accepted,
      blocked: job?.blocked || Math.max(0, processed - accepted),
      duplicates: job?.duplicates || 0,
      failed: job?.failed || 0,
      etaSeconds,
      rate,
      error,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid job request' }, { status: 500 });
  }
}
