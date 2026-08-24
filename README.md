# WebScope

Intelligent Web URL Discovery & Collection Platform

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

1. Install dependencies:
   ```bash
   npm install
   cd apps/api && npm install && cd ../..
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your database and Redis credentials.

4. Set up the database:
   ```bash
   cd apps/api
   npx prisma migrate dev --name init
   npx prisma generate
   cd ../..
   ```

### Development

Start the backend API:
```bash
cd apps/api
npm run dev
```

Start the frontend (in another terminal):
```bash
npm run dev
```

### Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # Next.js API routes (proxies to backend)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── search/            # Search composer, progress
│   │   ├── results/           # Result cards, toolbar
│   │   ├── filters/           # Filter components
│   │   └── layout/            # Header, footer, navigation
│   └── lib/
│       ├── types.ts           # TypeScript types
│       └── utils.ts           # Utility functions
├── apps/api/
│   ├── src/
│   │   ├── routes/            # Fastify route handlers
│   │   ├── workers/           # Background job workers
│   │   ├── infrastructure/    # Prisma, Redis, queue setup
│   │   └── server.ts          # Fastify entry point
│   └── prisma/
│       └── schema.prisma      # Database schema
└── README.md
```

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- TanStack Query

### Backend
- Fastify
- TypeScript
- Prisma
- PostgreSQL
- BullMQ + Redis

## License

MIT
