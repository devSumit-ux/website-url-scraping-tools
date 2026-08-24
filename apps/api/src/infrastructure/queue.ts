import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const jobQueue = new Queue('webscope-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 100,
      age: 7 * 24 * 3600,
    },
  },
});
