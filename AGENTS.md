<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WebScope Developer & Agent Guide

Welcome to **WebScope** — an autonomous multi-source website discovery, live HTTP validation, and zero-duplicate URL aggregation platform.

---

## 🧭 Repository Map & Core Files

| File / Directory | Purpose |
| :--- | :--- |
| [`src/app/page.tsx`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/src/app/page.tsx) | Main search dashboard, query filters, live progress, and result rendering |
| [`src/app/api/`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/src/app/api) | Next.js API routes that proxy requests to the Python scraping engine |
| [`src/components/`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/src/components) | Modular UI components (`search/`, `results/`, `header-actions.tsx`) |
| [`python_engine/server.py`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/python_engine/server.py) | FastAPI backend handling `/search`, `/progress`, `/results`, `/history/stats`, `/cache/*` |
| [`python_engine/scraper_engine.py`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/python_engine/scraper_engine.py) | Parallel discovery (DDG, Bing, Yahoo, etc.), domain validator, HTTP inspection |
| [`python_engine/mongo_storage.py`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/python_engine/mongo_storage.py) | MongoDB Atlas cloud persistence, TTL memory caching, and bulk synchronization |
| [`python_engine/scraped_history.json`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/python_engine/scraped_history.json) | Local offline persistence cache fallback |
| [`start.sh`](file:///home/sumitxdev/Desktop/website-url-scraping-tools/start.sh) | Production entrypoint starting both Python backend and Next.js frontend |

---

## ⚙️ Tech Stack & Key Conventions

- **Frontend**: Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS, Lucide icons).
- **Backend**: Python 3.10+ (FastAPI, Uvicorn, aiohttp, BeautifulSoup4, dnspython, pymongo).
- **Cloud Database**: MongoDB Atlas (`webscope_cache` database) with graceful offline fallback.
- **Port Allocation**:
  - Python Scraping Engine: `http://127.0.0.1:8000`
  - Next.js Web Application: `http://localhost:3000`

---

## 🛠 Useful Commands

### 1. Launch Services Locally
```bash
# Run both Frontend & Python Engine concurrently
npm run dev:all

# Run Python Engine only (Port 8000)
PYTHON_SCRAPER_PORT=8000 python3 python_engine/server.py

# Run Next.js Frontend only (Port 3000)
npm run dev
```

### 2. Validation & Quality Checks
```bash
# TypeScript verification
npx tsc --noEmit

# Python syntax compilation check
python3 -m py_compile python_engine/server.py python_engine/scraper_engine.py python_engine/mongo_storage.py

# Health check
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/history/stats
```

---

## 🔒 Important Architecture Guidelines

1. **Strict Apex Root Canonicalization**:
   All accepted URLs must be canonical apex roots (`https://www.domain.com`). Multi-level TLDs (`.co.uk`, `.com.au`, `.co.in`, etc.) must be correctly resolved using `DomainValidator.extract_root_domain()`.

2. **Global Thread-Safe Deduplication**:
   `GlobalDomainRegistry` in `scraper_engine.py` and `MongoCacheStorage` in `mongo_storage.py` ensure that concurrent searches across different browsers/devices never return duplicate domains.

3. **Security & Credentials**:
   Never commit `.env`, `webscopecred.env`, or `*.db` files to version control. Keep credentials in `.env.example` as placeholders only.
