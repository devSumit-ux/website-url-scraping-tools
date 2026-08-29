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

**WebScope** is a full-stack website discovery and URL scraping platform engineered for large-scale data collection. It combines a high-concurrency **FastAPI/AsyncIO Python engine** with a modern **Next.js 16 web interface** and **MongoDB Atlas cloud persistence**.

The system discovers, validates, and stores verified apex root websites (`https://www.example.com`) across global search indexes while eliminating subdomains, parked domains, redirects, and duplicate entries.

---

## ✨ Key Features

- **Multi-Source Parallel Discovery**: Aggregates candidate websites simultaneously from DuckDuckGo, Bing, Yahoo, Wikipedia, Reddit, GitHub, HackerNews, and Brave.
- **Strict Apex Root Normalization**: Enforces canonical URL formatting (`https://www.domain.com`) with complete multi-part TLD support (`.co.uk`, `.com.au`, `.co.in`, `.ac.jp`, `.gov.uk`, etc.).
- **Global Zero-Duplicate Registry**: Centralized, multi-user deduplication ensuring concurrent searches across different browsers/devices never return overlapping websites.
- **MongoDB Atlas Cloud Persistence**: Real-time cloud synchronization storing all approved URLs, filtered domains, and search session logs with local JSON fallback.
- **Live HTTP Health & Quality Inspection**: Asynchronous DNS and HTTP probe validation verifying genuine 200 OK responses and filtering parked or blank pages.
- **Real-Time Progress Streaming**: Dynamic ETA calculations, discovery throughput rate monitoring, and live accepted vs. filtered counters.
- **Modern Responsive UI**: Clean interface built with Next.js 16, Tailwind CSS, Lucide icons, search session history viewer, and one-click clipboard exports.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebScope Web UI (Next.js)                │
│             http://localhost:3000 (React 19 / TS)           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│             Python Scraping Server (FastAPI / Uvicorn)      │
│             http://127.0.0.1:8000                           │
├─────────────────────────────────────────────────────────────┤
│  • Multi-Source Parallel Search (DDG, Bing, Yahoo, etc.)    │
│  • GlobalDomainRegistry (Thread-Safe Deduplication)         │
│  • DomainValidator & Live HTTP Inspection                   │
├──────────────────────────────┬──────────────────────────────┤
│  MongoDB Cloud Cache         │  Local Fallback Storage      │
│  (MongoDB Atlas Cluster)     │  (scraped_history.json)      │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 📁 Repository Structure

```
website-url-scraping-tools/
├── python_engine/                  # High-Performance Python Backend
│   ├── scraper_engine.py          # Core scraping engine & domain validation logic
│   ├── mongo_storage.py           # MongoDB Atlas persistence & cloud caching layer
│   ├── server.py                  # FastAPI REST API endpoints
│   ├── requirements.txt           # Python package dependencies
│   └── scraped_history.json       # Local persistence cache fallback
├── src/                            # Next.js 16 Web Application
│   ├── app/                       # App router pages and API routes
│   │   ├── api/                   # Server-side API route handlers
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

*(Optional)* Configure your MongoDB Atlas URI in `.env` or `webscopecred.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.usvfwut.mongodb.net
```
*Note: If no MongoDB credentials are provided, WebScope automatically falls back to local file persistence (`scraped_history.json`).*

---

### 4. Run Locally

You can launch both the **Python Scraping Engine** (Port 8000) and **Next.js Web App** (Port 3000) simultaneously with one command:

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

## 🚢 Deployment

### Deploy on Render.com

This repository includes a pre-configured `render.yaml` and `start.sh` for one-click full-stack deployment on Render:

1. Create a new **Web Service** on [Render](https://render.com/).
2. Select your repository.
3. Build Command: `npm install && pip install -r python_engine/requirements.txt && npm run build`
4. Start Command: `./start.sh`
5. Add your `MONGODB_URI` under Environment Variables.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
