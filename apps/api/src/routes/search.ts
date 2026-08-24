import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../infrastructure/prisma';
import { jobQueue } from '../infrastructure/queue';

const searchSchema = z.object({
  query: z.string().min(1),
  searchType: z.enum(['auto', 'websites', 'pages', 'articles', 'research', 'documentation']).default('auto'),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  limit: z.number().int().min(1).max(5000).default(200),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  contentTypes: z.array(z.string()).optional(),
  language: z.string().optional(),
  region: z.string().optional(),
  domainLimit: z.number().int().min(1).default(25),
  diversityEnabled: z.boolean().default(true),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
    try {
      const body = searchSchema.parse(request.body);
      const userId = (request as any).user?.id || 'anonymous';

      const search = await prisma.search.create({
        data: {
          userId,
          query: body.query,
          searchType: body.searchType,
          dateFrom: body.dateRange?.from ? new Date(body.dateRange.from) : null,
          dateTo: body.dateRange?.to ? new Date(body.dateRange.to) : null,
          resultLimit: body.limit,
          status: 'queued',
          filters: {
            create: {
              includeDomains: body.includeDomains || [],
              excludeDomains: body.excludeDomains || [],
              contentTypes: body.contentTypes || [],
              language: body.language,
              region: body.region,
              domainLimit: body.domainLimit,
              diversityEnabled: body.diversityEnabled,
            },
          },
          job: {
            create: {
              status: 'queued',
              requestedCount: body.limit,
            },
          },
        },
        include: {
          job: true,
        },
      });

      await jobQueue.add('discovery', {
        searchId: search.id,
        query: body.query,
        searchType: body.searchType,
        limit: body.limit,
      });

      return reply.status(201).send({
        jobId: search.job.id,
        searchId: search.id,
        status: 'queued',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
