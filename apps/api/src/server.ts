import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { searchRoutes } from './routes/search';
import { jobRoutes } from './routes/job';
import { resultRoutes } from './routes/result';

const fastify = Fastify({
  logger: true,
});

async function build() {
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  });

  await fastify.register(searchRoutes, { prefix: '/api/v1/search' });
  await fastify.register(jobRoutes, { prefix: '/api/v1/jobs' });
  await fastify.register(resultRoutes, { prefix: '/api/v1/jobs' });

  fastify.get('/health', async () => ({ status: 'ok' }));

  const port = Number(process.env.PORT) || 3001;
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`API server listening on http://localhost:${port}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
