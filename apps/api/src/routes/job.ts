import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../infrastructure/prisma';

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { search: true },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return {
      id: job.id,
      status: job.status,
      requested: job.requestedCount,
      candidates: job.candidateCount,
      processed: job.processedCount,
      accepted: job.acceptedCount,
      blocked: job.blockedCount,
      duplicates: job.duplicateCount,
      failed: job.failedCount,
      error: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  });
};
