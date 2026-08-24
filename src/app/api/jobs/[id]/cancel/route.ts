import { NextRequest, NextResponse } from 'next/server';
import { updateJob } from '@/lib/job-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    updateJob(id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });

    try {
      await fetch(`http://localhost:8000/cancel/${id}`, { method: 'POST' });
    } catch {}

    return NextResponse.json({ status: 'cancelled', jobId: id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
