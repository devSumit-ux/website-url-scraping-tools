import { SearchRequest, JobStatus, SearchResult } from '@/lib/types';

interface Job {
  id: string;
  request: SearchRequest;
  status: JobStatus['status'];
  candidates: number;
  processed: number;
  accepted: number;
  blocked: number;
  duplicates: number;
  failed: number;
  results: SearchResult[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const jobs = new Map<string, Job>();

export function createJob(request: SearchRequest): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    request,
    status: 'queued',
    candidates: 0,
    processed: 0,
    accepted: 0,
    blocked: 0,
    duplicates: 0,
    failed: 0,
    results: [],
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, updates);
  return job;
}

export function addJobResults(id: string, results: SearchResult[]): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  job.results.push(...results);
  return job;
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}
