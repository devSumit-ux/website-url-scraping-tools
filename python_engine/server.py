#!/usr/bin/env python3
"""
WebScope Python Scraping Server
FastAPI server that handles scraping requests from Next.js
"""

import sys
import os
import json
import asyncio
import time
from typing import List, Dict, Optional, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper_engine import ScrapingEngine, HistoryLogger, DomainValidator, GlobalDomainRegistry
try:
    from mongo_storage import MongoCacheStorage
except ImportError:
    MongoCacheStorage = None
from fastapi.responses import JSONResponse, Response, PlainTextResponse

app = FastAPI(title="WebScope Scraping Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ACTIVE_JOBS: Dict[str, Dict] = {}
COMPLETED_RESULTS: Dict[str, List[Dict]] = {}

class SearchRequest(BaseModel):
    query: Optional[str] = ""
    job_id: Optional[str] = None
    limit: int = 1000
    time_frame: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    area: Optional[str] = None
    tld: Optional[str] = None
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None
    min_authority: float = 0.0

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/history/stats")
async def get_history_stats():
    """Return total count of historical unique scraped domains and URLs"""
    stats = await asyncio.to_thread(HistoryLogger.get_stats)
    return JSONResponse(content=stats)

@app.post("/history/clear")
async def clear_history():
    """Clear persistent history log"""
    await asyncio.to_thread(HistoryLogger.clear_history)
    return JSONResponse(content={"status": "cleared", "total_unique": 0})

@app.get("/cache/stats")
async def get_cache_stats():
    """Return live MongoDB Atlas cloud cache and local synchronization statistics"""
    stats = await asyncio.to_thread(HistoryLogger.get_stats)
    return JSONResponse(content=stats)

@app.get("/cache/export")
async def export_cache_json():
    """Download the full unified cache (MongoDB cloud + local) as structured JSON"""
    if MongoCacheStorage:
        storage = MongoCacheStorage.get_instance()
        data = storage.export_all_cache()
    else:
        history = HistoryLogger.load_history()
        data = {
            "source": "WebScope Local Cache",
            "exported_at": datetime.utcnow().isoformat(),
            "total_approved": len(history["domains"]),
            "domains": sorted(list(history["domains"])),
            "urls": sorted(list(history["urls"])),
            "filtered_domains": sorted(list(history["filtered_domains"]))
        }
    
    json_bytes = json.dumps(data, indent=2).encode('utf-8')
    headers = {
        "Content-Disposition": 'attachment; filename="webscope_cache_export.json"',
        "Content-Type": "application/json; charset=utf-8"
    }
    return Response(content=json_bytes, media_type="application/json", headers=headers)

@app.get("/cache/export/csv")
async def export_cache_csv():
    """Download all approved scraped URLs with metadata as a CSV file"""
    if MongoCacheStorage:
        storage = MongoCacheStorage.get_instance()
        csv_text = storage.export_csv_string()
    else:
        history = HistoryLogger.load_history()
        csv_text = "domain,url\n" + "\n".join(f"{d},https://www.{d}" for d in sorted(list(history["domains"])))

    headers = {
        "Content-Disposition": 'attachment; filename="webscope_scraped_urls.csv"',
        "Content-Type": "text/csv; charset=utf-8"
    }
    return Response(content=csv_text.encode('utf-8'), media_type="text/csv", headers=headers)

@app.post("/cache/sync")
async def sync_cache_to_mongo():
    """Force synchronization from local files to MongoDB Atlas cloud database"""
    if MongoCacheStorage:
        storage = MongoCacheStorage.get_instance()
        res = await asyncio.to_thread(storage.sync_local_to_mongo)
        return JSONResponse(content=res)
    return JSONResponse(content={"status": "pymongo_unavailable"})

@app.post("/cache/import")
async def import_cache_json(payload: Dict[str, Any]):
    """Import external JSON cache data into MongoDB Atlas"""
    if MongoCacheStorage:
        storage = MongoCacheStorage.get_instance()
        res = await asyncio.to_thread(storage.import_cache_data, payload)
        return JSONResponse(content=res)
    return JSONResponse(content={"status": "pymongo_unavailable"})

@app.post("/cache/upload-browser-urls")
async def upload_browser_urls(payload: Dict[str, Any]):
    """Upload browser cached URLs directly into MongoDB Atlas cloud database"""
    urls = payload.get("urls", [])
    if not urls:
        return JSONResponse(content={"uploaded": 0, "status": "empty_list"})

    def _sync_in_thread():
        domains = []
        for u in urls:
            d = DomainValidator.extract_root_domain(u)
            if d:
                domains.append(d)

        if MongoCacheStorage:
            storage = MongoCacheStorage.get_instance()
            upserted = storage.save_bulk_domains(domains, urls)
            stats = storage.get_stats()
            return {
                "status": "success",
                "uploaded_urls": len(urls),
                "upserted_unique": upserted,
                "total_in_mongo": stats.get("total_unique_approved", 0)
            }

        history = HistoryLogger.load_history()
        for d in domains:
            history['domains'].add(d)
        for u in urls:
            history['urls'].add(u)
        return {"status": "saved_locally", "uploaded_urls": len(urls), "total_unique": len(history['domains'])}

    result = await asyncio.to_thread(_sync_in_thread)
    return JSONResponse(content=result)

@app.get("/progress/{job_id}")
async def get_progress(job_id: str):
    """Return live progress, rate, and workload-based dynamic ETA for an active scraping job"""
    if job_id in ACTIVE_JOBS:
        return JSONResponse(content=ACTIVE_JOBS[job_id])
    return JSONResponse(content={
        "status": "searching",
        "candidates": 0,
        "processed": 0,
        "accepted": 0,
        "eta_seconds": None,
        "rate": 0.0,
        "elapsed": 0.0
    })

def format_endpoint_url(domain_or_url: str) -> str:
    if not domain_or_url:
        return ""
    d = str(domain_or_url).strip()
    root = DomainValidator.extract_root_domain(d)
    if not root:
        return d
    return f"https://www.{root}"

@app.get("/results/{job_id}")
async def get_results(job_id: str):
    """Return completed scraped results for a given job, formatted strictly as https://www.domainName.com"""
    raw_results = COMPLETED_RESULTS.get(job_id, [])
    job_info = ACTIVE_JOBS.get(job_id, {})
    
    formatted_results = []
    seen_result_urls = set()
    for r in raw_results:
        item = dict(r)
        d = item.get('domain') or item.get('url', '')
        fmt_url = format_endpoint_url(d)
        if not fmt_url or fmt_url in seen_result_urls:
            continue
        seen_result_urls.add(fmt_url)
        item['url'] = fmt_url
        formatted_results.append(item)

    return JSONResponse(content={
        "job_id": job_id,
        "status": job_info.get("status", "completed" if formatted_results else "searching"),
        "results": formatted_results,
        "total": len(formatted_results),
    })

@app.get("/history/sessions")
async def get_history_sessions(limit: int = 50):
    """Return list of recent completed search sessions"""
    sessions = HistoryLogger.get_recent_sessions(limit=limit)
    return JSONResponse(content={"sessions": sessions, "total_sessions": len(sessions)})

RUNNING_TASKS: Dict[str, asyncio.Task] = {}
ACTIVE_ENGINES: Dict[str, Any] = {}

@app.post("/cancel/{job_id}")
@app.get("/cancel/{job_id}")
async def cancel_job(job_id: str):
    """Cancel an active scraping job immediately and terminate background workers"""
    engine = ACTIVE_ENGINES.pop(job_id, None)
    if engine and hasattr(engine, 'cancel'):
        try:
            engine.cancel()
        except Exception:
            pass

    task = RUNNING_TASKS.pop(job_id, None)
    if task and not task.done():
        task.cancel()

    ACTIVE_JOBS[job_id] = {
        'status': 'cancelled',
        'candidates': 0,
        'processed': 0,
        'accepted': 0,
        'eta_seconds': None,
        'rate': 0.0,
        'elapsed': 0.0
    }
    return JSONResponse(content={"status": "cancelled", "job_id": job_id})

@app.post("/cancel-all")
@app.get("/cancel-all")
async def cancel_all_jobs():
    """Cancel all active scraping jobs immediately"""
    for job_id, engine in list(ACTIVE_ENGINES.items()):
        if engine and hasattr(engine, 'cancel'):
            try:
                engine.cancel()
            except Exception:
                pass
    ACTIVE_ENGINES.clear()

    for job_id, task in list(RUNNING_TASKS.items()):
        if task and not task.done():
            task.cancel()
        if job_id in ACTIVE_JOBS:
            ACTIVE_JOBS[job_id]['status'] = 'cancelled'
    RUNNING_TASKS.clear()
    return JSONResponse(content={"status": "all_cancelled"})

async def _run_scrape_task(job_id: str, query: str, limit: int, country: Optional[str], time_frame: Optional[str] = None, area: Optional[str] = None, tld: Optional[str] = None, include_domains: Optional[List[str]] = None, exclude_domains: Optional[List[str]] = None):
    """Background runner that executes scraping until target is 100% finished without blocking HTTP sockets"""
    start_ts = time.time()
    
    # Rolling window progress tracker for realistic ETA
    recent_checkpoints = []

    engine = None
    try:
        engine = ScrapingEngine(max_concurrent=min(1200, max(500, limit * 10)))
        ACTIVE_ENGINES[job_id] = engine

        def on_progress(data):
            now = time.time()
            elapsed = round(now - start_ts, 1)
            processed = data.get('processed', 0)
            accepted = data.get('accepted', 0)
            candidates = data.get('discovered', 0)
            
            recent_checkpoints.append((now, accepted, processed))
            while recent_checkpoints and (now - recent_checkpoints[0][0]) > 8.0:
                recent_checkpoints.pop(0)

            rate = 0.0
            if len(recent_checkpoints) >= 2:
                dt = max(0.5, recent_checkpoints[-1][0] - recent_checkpoints[0][0])
                d_acc = recent_checkpoints[-1][1] - recent_checkpoints[0][1]
                d_proc = recent_checkpoints[-1][2] - recent_checkpoints[0][2]
                if d_acc > 0:
                    rate = round(d_acc / dt, 2)
                elif d_proc > 0:
                    rate = round((d_proc / dt) * 0.35, 2)
            
            if rate == 0.0 and elapsed > 0.5:
                if accepted > 0:
                    rate = round(accepted / elapsed, 2)
                elif processed > 0:
                    rate = round((processed / elapsed) * 0.35, 2)

            remaining_needed = max(0, limit - accepted)
            eta_seconds = None
            if elapsed >= 5.0 and processed >= 20 and rate > 0.1 and remaining_needed > 0:
                eta_seconds = round(remaining_needed / rate, 1)

            ACTIVE_JOBS[job_id] = {
                'status': 'searching',
                'candidates': candidates,
                'processed': processed,
                'accepted': accepted,
                'eta_seconds': eta_seconds,
                'rate': rate,
                'elapsed': elapsed
            }
            if engine and hasattr(engine, 'pending_results_buffer') and engine.pending_results_buffer:
                COMPLETED_RESULTS[job_id] = list(engine.pending_results_buffer)

        results = await engine.search(query, limit, on_progress=on_progress, country=country, time_frame=time_frame, area=area, tld=tld, include_domains=include_domains, exclude_domains=exclude_domains)
        
        elapsed_total = round(time.time() - start_ts, 1)
        COMPLETED_RESULTS[job_id] = results
        status = 'completed' if len(results) >= limit else 'partial'
        ACTIVE_JOBS[job_id] = {
            'status': status,
            'candidates': engine.total_discovered if engine else len(results),
            'processed': engine.total_processed if engine else len(results),
            'accepted': len(results),
            'eta_seconds': 0,
            'rate': round(len(results) / max(elapsed_total, 1), 2),
            'elapsed': elapsed_total
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        rescued_results = []
        if engine and hasattr(engine, 'pending_results_buffer') and engine.pending_results_buffer:
            rescued_results = list(engine.pending_results_buffer)

        if rescued_results:
            COMPLETED_RESULTS[job_id] = rescued_results
            ACTIVE_JOBS[job_id] = {
                'status': 'completed' if len(rescued_results) >= limit else 'partial',
                'candidates': engine.total_discovered if engine else len(rescued_results),
                'processed': engine.total_processed if engine else len(rescued_results),
                'accepted': len(rescued_results),
                'eta_seconds': 0,
                'rate': round(len(rescued_results) / max(time.time() - start_ts, 1), 2),
                'elapsed': round(time.time() - start_ts, 1)
            }
        else:
            ACTIVE_JOBS[job_id] = {
                'status': 'completed',
                'candidates': engine.total_discovered if engine else 0,
                'processed': engine.total_processed if engine else 0,
                'accepted': 0,
                'eta_seconds': 0,
                'rate': 0,
                'elapsed': round(time.time() - start_ts, 1)
            }

@app.post("/search")
async def search(request: SearchRequest):
    """Starts a scraping job in the background and returns immediately (< 2ms) to prevent any HTTP timeout"""
    query = request.query.strip() if request.query else ""
    limit = min(request.limit, 100000)
    country = request.country or request.region or None
    time_frame = request.time_frame or None
    area = request.area or None
    tld = request.tld or None
    job_id = request.job_id or f"job_{int(time.time()*1000)}"

    ACTIVE_JOBS[job_id] = {
        'status': 'searching',
        'candidates': 0,
        'processed': 0,
        'accepted': 0,
        'eta_seconds': None,
        'rate': 0.0,
        'elapsed': 0.0
    }

    # Launch background task and register in RUNNING_TASKS
    task = asyncio.create_task(_run_scrape_task(job_id, query, limit, country, time_frame, area=area, tld=tld, include_domains=request.include_domains, exclude_domains=request.exclude_domains))
    RUNNING_TASKS[job_id] = task

    return JSONResponse(content={
        "job_id": job_id,
        "status": "searching",
        "limit": limit,
    })

if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_SCRAPER_PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port, log_level='info', loop='asyncio', timeout_keep_alive=5)
