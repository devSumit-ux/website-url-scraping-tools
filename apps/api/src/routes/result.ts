import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../infrastructure/prisma';

export const resultRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id/results', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page = '1', limit = '50', sort = 'rank' } = request.query as {
      page?: string;
      limit?: string;
      sort?: string;
    };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const job = await prisma.job.findUnique({
      where: { id },
      include: { search: true },
    });

    if (!job || job.searchId !== (request as any).searchId) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const results = await prisma.searchResult.findMany({
      where: { searchId: job.searchId },
      include: { page: true },
      orderBy: { rank: 'asc' },
      skip,
      take: limitNum,
    });

    const total = await prisma.searchResult.count({
      where: { searchId: job.searchId },
    });

    return {
      results: results.map((r: any) => ({
        id: r.page.id,
        title: r.page.title,
        url: r.page.url,
        domain: r.page.domain,
        description: r.page.description,
        publishedAt: r.page.publishedAt,
        modifiedAt: r.page.modifiedAt,
        dateSource: r.page.dateSource,
        dateConfidence: r.page.dateConfidence,
        contentType: r.page.contentType,
        language: r.page.language,
        safetyStatus: r.page.safetyStatus,
        rank: r.rank,
        relevanceScore: r.relevanceScore,
        freshnessScore: r.freshnessScore,
        qualityScore: r.qualityScore,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  });
};
