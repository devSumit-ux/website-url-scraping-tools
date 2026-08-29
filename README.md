# WebScope — Autonomous Website Discovery & Scraping Engine

<div align="center">

![WebScope Banner](public/logo.svg)

**High-throughput, real-time autonomous website discovery, live HTTP validation, and zero-duplicate URL aggregation platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Cloud_Cache-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## ⚡ Overview

**WebScope** is an enterprise-grade website discovery and URL scraping platform engineered for large-scale, high-concurrency web data collection. It pairs a **FastAPI/AsyncIO Python engine** with a modern **Next.js 16 web interface** and **MongoDB Atlas cloud persistence**.

The platform discovers, sanitizes, inspects, and delivers verified canonical apex websites (`https://www.example.com`) across global search indexes while eliminating subdomains, parked domains, redirects, and duplicates.

---

## 🔬 How The Scraping Engine Works (Deep Dive)

```
                       User Search Request ("hospital in texas")
                                         │
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │ 1. Query Expansion & Parallel Engine Harvest  │
                 │   • DuckDuckGo  • Bing        • Yahoo         │
                 │   • Wikipedia   • Reddit      • GitHub        │
                 │   • HackerNews  • Brave       • Targeted Dorks│
                 └───────────────────────┬───────────────────────┘
                                         │ Raw HTML & Outbound Links
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │ 2. Canonical Apex Domain Extraction           │
                 │   • Strip Subdomains (blog.dept.hospital.com) │
                 │   • Multi-Part TLD (.co.uk, .com.au, .co.in)  │
                 │   • Format -> https://www.hospital.com        │
                 └───────────────────────┬───────────────────────┘
                                         │ Normalized Candidate Root
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │ 3. Quality & Anti-Spam Heuristic Filter       │
                 │   • Reject digits in domain (0-9)             │
                 │   • Reject sequential patterns (xyza, xyzb)   │
                 │   • Reject blacklisted & aggregator domains   │
                 └───────────────────────┬───────────────────────┘
                                         │ Valid Domain Candidate
                                         ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │ 4. MULTI-LAYER ZERO-DUPLICATE VERIFICATION GATEWAY                     │
    │   • Layer 1: In-Flight Lock (Prevents race conditions across workers)  │
    │   • Layer 2: GlobalDomainRegistry Memory Cache (O(1) instant check)   │
    │   • Layer 3: MongoDB Atlas Cloud Registry (61,000+ approved URLs)      │
    │   • Layer 4: Local History Cache (scraped_history.json fallback)       │
    └────────────────────────────────────┬───────────────────────────────────┘
                                         │ Brand New, Unseen Domain
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │ 5. Asynchronous Live HTTP & Content Probe     │
                 │   • DNS Resolution & TCP handshake            │
                 │   • 200 OK verification (No 4xx/5xx/timeouts) │
                 │   • Anti-Parked/Empty page heuristic analysis │
                 │   • Extract page <title>, meta & word count   │
                 └───────────────────────┬───────────────────────┘
                                         │ Verified Live Website
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │ 6. Real-Time Delivery & Cloud Persistence     │
                 │   • Stream to UI progress buffer              │
                 │   • Atomic Upsert to MongoDB Atlas            │
                 │   • Append to local persistent cache          │
                 └───────────────────────────────────────────────┘
```

---

## 🛡 Guaranteed Zero-Duplicate Architecture

WebScope enforces **4 independent layers of deduplication**, guaranteeing that no URL is ever approved or delivered more than once across concurrent user sessions, multiple devices, or repeated searches:

### 1. Real-Time In-Flight Mutex (`_in_flight_domains`)
- When a candidate domain is discovered by an async worker, the engine acquires an atomic asynchronous lock.
- If another parallel worker or concurrent user query is evaluating the same domain at the exact same millisecond, the second attempt is immediately discarded.

### 2. Thread-Safe Global Memory Registry (`GlobalDomainRegistry`)
- Pre-loaded with all known approved and filtered domains from persistent storage.
- Performs an $O(1)$ memory lookup before initiating any DNS lookup or HTTP request, eliminating redundant network overhead.

### 3. MongoDB Atlas Cloud Unique Indexing
- In MongoDB Atlas, the `approved_urls` collection enforces a **strict unique compound index** on `{ domain: 1 }`.
- Operations use atomic bulk `$setOnInsert` and `$set` upserts, guaranteeing that even distributed server instances cannot write duplicate records.

### 4. Local File Persistence Fallback (`scraped_history.json`)
- Every approved and filtered domain is mirrored into a local JSON cache file.
- If cloud connectivity is temporarily interrupted, the system automatically uses the local persistence cache to maintain 100% deduplication guarantees.

---

## 🌐 Search Engines & Discovery Strategy

WebScope scrapes from **8 primary search providers and knowledge indexes** simultaneously:

1. **DuckDuckGo HTML & Lite Engines**: Organic search results without tracker bias.
2. **Bing Web Index**: Broad regional and commercial website listings.
3. **Yahoo Search**: Deep-indexed catalog queries.
4. **Wikipedia External Link Tree**: Authority outbound links cited in encyclopedic articles.
5. **Reddit & HackerNews Discussions**: Curated real-world project and organizational sites.
6. **GitHub Repositories**: Organization homepages and official project websites.
7. **Brave Search API / Discovery**: Independent web index crawlers.
8. **Smart Search Dorks**: Dynamic query transformation (`inurl:`, `site:`, `related:`, and country-code operators).

---

## 📏 Quality & Compliance Rules

Every candidate URL must satisfy the following strict compliance rules before being accepted:

| Rule | Description | Status |
| :--- | :--- | :---: |
| **Strict Apex Root** | Subdomains are stripped to canonical root (`https://www.domain.com`) | ✅ Enforced |
| **No Numeric Domains** | Domains containing numbers (0–9) are rejected | ✅ Enforced |
| **No Sequential Patterns** | Series patterns (e.g. `xyza`, `xyzb`, `xyzc`) are blocked | ✅ Enforced |
| **Multi-Part TLD Support** | Accurately resolves `.co.uk`, `.com.au`, `.co.in`, `.ac.jp`, etc. | ✅ Enforced |
| **Live 200 OK Response** | Only responds with valid HTTP 200 without request timeouts | ✅ Enforced |
| **Anti-Parked Filter** | Parked, for-sale, placeholder, or blank pages are rejected | ✅ Enforced |
| **Zero Redirection** | URLs redirecting to external domains or subdomains are filtered | ✅ Enforced |

---

## 📁 Repository Structure

```
website-url-scraping-tools/
├── python_engine/                  # High-Performance Python Backend
│   ├── scraper_engine.py          # Core scraping engine, discovery & validation logic
│   ├── mongo_storage.py           # MongoDB Atlas persistence & cloud caching layer
│   ├── server.py                  # FastAPI REST API endpoints
│   ├── requirements.txt           # Python package dependencies
│   └── scraped_history.json       # Local persistence cache (61,000+ domains)
├── src/                            # Next.js 16 Web Application
│   ├── app/                       # App router pages and API routes
│   │   ├── api/                   # Server-side API route handlers & proxy
│   │   ├── layout.tsx             # Root layout & theme configuration
│   │   └── page.tsx               # Main scraper search dashboard
│   ├── components/                # Modular React UI components
│   │   ├── search/                # Search composer & live progress widgets
│   │   ├── results/               # Results grid, list, and filters
│   │   └── header-actions.tsx     # Navigation & history modal triggers
│   └── lib/                       # Shared TypeScript interfaces & utilities
├── public/                         # Static assets (logos, icons)
├── Dockerfile                      # Container build definition
├── render.yaml                     # Render.com cloud deployment blueprint
├── start.sh                        # Dual-service startup script
├── package.json                    # Node.js dependencies & scripts
└── README.md                       # Documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js** 18.x or higher
- **Python** 3.10 or higher (`pip` installed)
- *(Optional)* **MongoDB Atlas** account for cloud synchronization

---

### 1. Clone the Repository

```bash
git clone https://github.com/devSumit-ux/website-url-scraping-tools.git
cd website-url-scraping-tools
```

---

### 2. Install Dependencies

#### Install Node.js Frontend Dependencies:
```bash
npm install
```

#### Install Python Backend Dependencies:
```bash
pip install -r python_engine/requirements.txt
```

---

### 3. Environment Configuration

Copy the example environment configuration:
```bash
cp .env.example .env
```

*(Optional)* Configure your MongoDB Atlas URI in `.env`:
```env
PYTHON_SCRAPER_PORT=8000
PYTHON_SCRAPER_URL=http://127.0.0.1:8000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.usvfwut.mongodb.net
```
*Note: If no MongoDB URI is supplied, WebScope automatically falls back to local file persistence (`scraped_history.json`).*

---

### 4. Run Locally

Start both the **Python Scraping Engine** (Port 8000) and **Next.js Web App** (Port 3000) simultaneously with one command:

```bash
npm run dev:all
```

Or start them individually in separate terminals:

```bash
# Terminal 1: Python Engine
PYTHON_SCRAPER_PORT=8000 python3 python_engine/server.py

# Terminal 2: Next.js Frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Reference

The FastAPI backend runs on port `8000` (and is proxied via Next.js at `/api/*`):

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/health` | `GET` | Server health check and timestamp |
| `/search` | `POST` | Dispatches an asynchronous scraping job |
| `/progress/{job_id}` | `GET` | Real-time stream of discovery rate, processed count, and ETA |
| `/results/{job_id}` | `GET` | Retrieves verified results for a completed or active job |
| `/history/stats` | `GET` | Returns global unique approved count and database metrics |
| `/cache/stats` | `GET` | Detailed MongoDB cloud cache statistics |
| `/cache/upload-browser-urls` | `POST` | Bulk upserts browser-discovered URLs into MongoDB Atlas |

---

## 🚢 Production Deployment

### Deploy on Render.com

This repository includes a pre-configured `render.yaml` and `start.sh` for one-click full-stack deployment:

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub repository.
3. **Build Command**: `npm install && pip install -r python_engine/requirements.txt && npm run build`
4. **Start Command**: `./start.sh`
5. Set `MONGODB_URI` under Environment Variables.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
