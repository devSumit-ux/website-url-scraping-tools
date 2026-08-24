import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/job-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let currentStatus = job.status;
    let candidates = job.candidates;
    let processed = job.processed;
    let accepted = job.accepted;
    let etaSeconds: number | null = null;
    let rate = 0;

    if (job.status !== 'completed' && job.status !== 'failed') {
      try {
        const pyRes = await fetch(`http://localhost:8000/progress/${job.id}`, { cache: 'no-store' });
        if (pyRes.ok) {
          const pyData = await pyRes.json();
          if (pyData.candidates !== undefined) candidates = Math.max(candidates, pyData.candidates);
          if (pyData.processed !== undefined) processed = Math.max(processed, pyData.processed);
          if (pyData.accepted !== undefined) accepted = Math.max(accepted, pyData.accepted);
          if (pyData.eta_seconds !== undefined) etaSeconds = pyData.eta_seconds;
          if (pyData.rate !== undefined) rate = pyData.rate;
          if (pyData.status) {
            currentStatus = pyData.status;
            updateJob(job.id, {
              status: pyData.status,
              candidates,
              processed,
              accepted,
              completedAt: pyData.status === 'completed' || pyData.status === 'failed' ? new Date().toISOString() : undefined,
            });
          }
        }
      } catch {}
    }

    return NextResponse.json({
      id: job.id,
      status: currentStatus,
      requested: job.accepted + job.blocked + job.duplicates + job.failed,
      candidates,
      processed,
      accepted,
      blocked: job.blocked,
      duplicates: job.duplicates,
      failed: job.failed,
      etaSeconds,
      rate,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
