"""
WebScope MongoDB Cloud Cache & Persistence Layer
Stores approved scraped URLs, domains, metadata, and search histories in MongoDB Atlas.
Guarantees global zero-duplicate scraping and real-time cloud synchronization.
"""

import os
import sys
import json
import csv
import io
import time
from typing import Dict, List, Set, Optional, Any
from datetime import datetime
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

for env_path in [
    os.path.join(PROJECT_DIR, 'webscopecred.env'),
    os.path.join(BASE_DIR, 'webscopecred.env'),
    os.path.join(PROJECT_DIR, '.env'),
    os.path.join(PROJECT_DIR, '.env.local')
]:
    if os.path.exists(env_path):
        load_dotenv(env_path, override=False)

try:
    from pymongo import MongoClient, UpdateOne, ASCENDING
    from pymongo.errors import PyMongoError
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False


class MongoCacheStorage:
    """Manages cloud persistence and caching in MongoDB Atlas."""
    
    _instance: Optional['MongoCacheStorage'] = None
    _client: Optional[Any] = None
    _db: Optional[Any] = None
    _connected: bool = False
    _last_connect_try: float = 0.0

    def __init__(self):
        self._init_connection()

    @classmethod
    def get_instance(cls) -> 'MongoCacheStorage':
        if cls._instance is None:
            cls._instance = MongoCacheStorage()
        return cls._instance

    def _init_connection(self):
        if not PYMONGO_AVAILABLE:
            self._connected = False
            return

        for p in [
            os.path.join(PROJECT_DIR, 'webscopecred.env'),
            os.path.join(BASE_DIR, 'webscopecred.env'),
            '/home/sumitxdev/Desktop/website-url-scraping-tools/webscopecred.env'
        ]:
            if os.path.exists(p):
                load_dotenv(p, override=True)

        mongo_uri = os.getenv("MONGODB_URI")
        if not mongo_uri:
            username = os.getenv("MONGODB_USERNAME")
            password = os.getenv("MONGODB_PASSWORD")
            if username and password:
                mongo_uri = f"mongodb+srv://{username}:{password}@cluster0.usvfwut.mongodb.net"

        if not mongo_uri:
            self._connected = False
            return

        now = time.time()
        if now - self._last_connect_try < 10.0 and not self._connected:
            return
        self._last_connect_try = now

        try:
            self._client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=8000,
                connectTimeoutMS=8000,
                socketTimeoutMS=8000,
                maxPoolSize=20
            )
            self._client.admin.command('ping')
            self._db = self._client['webscope_cache']
            
            # Ensure indexes
            self._db.approved_urls.create_index([("domain", ASCENDING)], unique=True)
            self._db.approved_urls.create_index([("url", ASCENDING)])
            self._db.approved_urls.create_index([("created_at", ASCENDING)])
            self._db.filtered_domains.create_index([("domain", ASCENDING)], unique=True)
            self._db.search_sessions.create_index([("created_at", ASCENDING)])
            
            self._connected = True
        except Exception:
            self._connected = False

    def is_connected(self) -> bool:
        if not self._connected and time.time() - self._last_connect_try > 30.0:
            self._init_connection()
        return self._connected

    _cached_approved_domains: Optional[Set[str]] = None
    _cached_approved_urls: Optional[Set[str]] = None
    _cached_filtered_domains: Optional[Set[str]] = None
    _last_cache_time: float = 0.0

    def load_approved_domains(self, force_refresh: bool = False) -> Set[str]:
        """Load all approved domain names from MongoDB with fast memory cache."""
        now = time.time()
        if not force_refresh and self._cached_approved_domains is not None and (now - self._last_cache_time < 60.0):
            return set(self._cached_approved_domains)

        if not self.is_connected() or self._db is None:
            return set(self._cached_approved_domains or [])
        try:
            cursor = self._db.approved_urls.find({}, {"domain": 1, "_id": 0})
            domains = {doc["domain"] for doc in cursor if doc.get("domain")}
            self._cached_approved_domains = domains
            self._last_cache_time = now
            return set(domains)
        except Exception:
            return set(self._cached_approved_domains or [])

    def load_approved_urls(self, force_refresh: bool = False) -> Set[str]:
        """Load all approved full URLs from MongoDB with fast memory cache."""
        now = time.time()
        if not force_refresh and self._cached_approved_urls is not None and (now - self._last_cache_time < 60.0):
            return set(self._cached_approved_urls)

        if not self.is_connected() or self._db is None:
            return set(self._cached_approved_urls or [])
        try:
            cursor = self._db.approved_urls.find({}, {"url": 1, "_id": 0})
            urls = {doc["url"] for doc in cursor if doc.get("url")}
            self._cached_approved_urls = urls
            self._last_cache_time = now
            return set(urls)
        except Exception:
            return set(self._cached_approved_urls or [])

    def load_filtered_domains(self, force_refresh: bool = False) -> Set[str]:
        """Load all filtered domain names from MongoDB with fast memory cache."""
        now = time.time()
        if not force_refresh and self._cached_filtered_domains is not None and (now - self._last_cache_time < 60.0):
            return set(self._cached_filtered_domains)

        if not self.is_connected() or self._db is None:
            return set(self._cached_filtered_domains or [])
        try:
            cursor = self._db.filtered_domains.find({}, {"domain": 1, "_id": 0})
            domains = {doc["domain"] for doc in cursor if doc.get("domain")}
            self._cached_filtered_domains = domains
            self._last_cache_time = now
            return set(domains)
        except Exception:
            return set(self._cached_filtered_domains or [])

    def save_approved_results(self, results: List[Dict[str, Any]], query: str = "") -> int:
        """Upsert newly approved scraped results to MongoDB."""
        if not self.is_connected() or self._db is None or not results:
            return 0

        ops = []
        now_iso = datetime.utcnow().isoformat()

        for r in results:
            domain = r.get("domain")
            url = r.get("url")
            if not domain:
                continue

            doc = {
                "url": url or f"https://www.{domain}",
                "domain": domain,
                "title": r.get("title") or domain.capitalize(),
                "description": r.get("description") or "",
                "authority_score": r.get("authority_score", 0.0),
                "relevance_score": r.get("relevance_score", 0.0),
                "word_count": r.get("word_count", 0),
                "status_code": r.get("status_code", 200),
                "is_alive": r.get("is_alive", True),
                "query": query,
                "updated_at": now_iso,
            }

            ops.append(
                UpdateOne(
                    {"domain": domain},
                    {
                        "$set": doc,
                        "$setOnInsert": {"created_at": now_iso}
                    },
                    upsert=True
                )
            )

        if ops:
            try:
                res = self._db.approved_urls.bulk_write(ops, ordered=False)
                return (res.upserted_count or 0) + (res.modified_count or 0)
            except Exception:
                return 0
        return 0

    def save_bulk_domains(self, domains: List[str], urls: Optional[List[str]] = None) -> int:
        """Bulk upsert domain list to MongoDB in high-speed batches."""
        if not self.is_connected() or self._db is None or not domains:
            return 0

        now_iso = datetime.utcnow().isoformat()
        total_upserted = 0
        url_map = {}
        if urls:
            for u in urls:
                d = u.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
                if d:
                    url_map[d] = u

        batch_size = 1500
        for i in range(0, len(domains), batch_size):
            batch = domains[i:i + batch_size]
            ops = []
            for d in batch:
                if not d:
                    continue
                clean_d = d.strip().lower()
                clean_url = url_map.get(clean_d, f"https://www.{clean_d}")
                ops.append(
                    UpdateOne(
                        {"domain": clean_d},
                        {
                            "$set": {
                                "domain": clean_d,
                                "url": clean_url,
                                "is_alive": True,
                                "updated_at": now_iso
                            },
                            "$setOnInsert": {
                                "title": clean_d.capitalize(),
                                "created_at": now_iso
                            }
                        },
                        upsert=True
                    )
                )
            if ops:
                try:
                    res = self._db.approved_urls.bulk_write(ops, ordered=False)
                    total_upserted += (res.upserted_count or 0)
                except Exception:
                    pass

        return total_upserted

    def save_filtered_domains(self, domains: Set[str], query: str = "") -> int:
        """Upsert filtered domains to MongoDB."""
        if not self.is_connected() or self._db is None or not domains:
            return 0

        ops = []
        now_iso = datetime.utcnow().isoformat()

        for d in domains:
            if not d:
                continue
            ops.append(
                UpdateOne(
                    {"domain": d},
                    {
                        "$set": {"domain": d, "last_filtered_at": now_iso, "query": query},
                        "$setOnInsert": {"created_at": now_iso}
                    },
                    upsert=True
                )
            )

        if ops:
            try:
                res = self._db.filtered_domains.bulk_write(ops, ordered=False)
                return (res.upserted_count or 0) + (res.modified_count or 0)
            except Exception:
                return 0
        return 0

    def log_search_session(self, query: str, results: List[Dict[str, Any]], elapsed_sec: float) -> None:
        """Save search session log in MongoDB Atlas."""
        if not self.is_connected() or self._db is None:
            return
        try:
            doc = {
                "query": query,
                "results_count": len(results),
                "domains": [r.get("domain") for r in results if r.get("domain")],
                "elapsed_seconds": round(elapsed_sec, 2),
                "created_at": datetime.utcnow().isoformat()
            }
            self._db.search_sessions.insert_one(doc)
        except Exception:
            pass

    def export_all_cache(self) -> Dict[str, Any]:
        """Export all cloud cache data as structured dictionary for JSON download."""
        approved_docs = []
        filtered_list = []

        if self.is_connected() and self._db is not None:
            try:
                cursor = self._db.approved_urls.find({}, {"_id": 0}).sort("created_at", -1)
                approved_docs = list(cursor)
                
                f_cursor = self._db.filtered_domains.find({}, {"domain": 1, "_id": 0})
                filtered_list = [f["domain"] for f in f_cursor if f.get("domain")]
            except Exception:
                pass

        # Fallback / merge with local JSON
        local_history_path = os.path.join(BASE_DIR, "scraped_history.json")
        if os.path.exists(local_history_path):
            try:
                with open(local_history_path, "r", encoding="utf-8") as f:
                    local_data = json.load(f)
                    existing_domains = {doc.get("domain") for doc in approved_docs if doc.get("domain")}
                    
                    for r in local_data.get("results", []):
                        if r.get("domain") and r.get("domain") not in existing_domains:
                            approved_docs.append(r)
                            existing_domains.add(r.get("domain"))
                            
                    for d in local_data.get("domains", []):
                        if d and d not in existing_domains:
                            approved_docs.append({
                                "domain": d,
                                "url": f"https://www.{d}",
                                "title": d.capitalize(),
                                "is_alive": True
                            })
                            existing_domains.add(d)

                    for fd in local_data.get("filtered_domains", []):
                        if fd not in filtered_list:
                            filtered_list.append(fd)
            except Exception:
                pass

        return {
            "source": "WebScope MongoDB Atlas Cloud Cache",
            "exported_at": datetime.utcnow().isoformat(),
            "total_approved": len(approved_docs),
            "total_filtered": len(filtered_list),
            "cloud_connected": self.is_connected(),
            "database": "webscope_cache",
            "results": approved_docs,
            "domains": [d["domain"] for d in approved_docs if d.get("domain")],
            "filtered_domains": filtered_list
        }

    def export_csv_string(self) -> str:
        """Export all approved scraped URLs as CSV string."""
        cache_data = self.export_all_cache()
        results = cache_data.get("results", [])

        output = io.StringIO()
        fieldnames = ["domain", "url", "title", "description", "authority_score", "relevance_score", "word_count", "query", "created_at"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for r in results:
            writer.writerow({
                "domain": r.get("domain", ""),
                "url": r.get("url", f"https://www.{r.get('domain', '')}"),
                "title": r.get("title", r.get("domain", "")),
                "description": r.get("description", ""),
                "authority_score": r.get("authority_score", 0),
                "relevance_score": r.get("relevance_score", 0),
                "word_count": r.get("word_count", 0),
                "query": r.get("query", ""),
                "created_at": r.get("created_at", "")
            })

        return output.getvalue()

    def sync_local_to_mongo(self) -> Dict[str, Any]:
        """Sync complete local history into MongoDB Atlas."""
        local_history_path = os.path.join(BASE_DIR, "scraped_history.json")
        if not os.path.exists(local_history_path):
            return {"synced_domains": 0, "status": "no_local_file"}

        try:
            with open(local_history_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            domains = data.get("domains", [])
            urls = data.get("urls", [])
            filtered = set(data.get("filtered_domains", []))
            
            inserted_domains = self.save_bulk_domains(domains, urls)
            inserted_filtered = self.save_filtered_domains(filtered, query="local_sync")
            
            return {
                "synced_domains": inserted_domains,
                "synced_filtered": inserted_filtered,
                "total_in_mongo": self.get_stats().get("total_unique_approved", 0),
                "status": "success"
            }
        except Exception as e:
            return {"error": str(e), "status": "error"}

    _cached_stats: Optional[Dict[str, Any]] = None
    _last_stats_time: float = 0.0

    def get_stats(self) -> Dict[str, Any]:
        """Get live MongoDB statistics with fast in-memory caching."""
        now = time.time()
        if self._cached_stats is not None and (now - self._last_stats_time < 4.0):
            return dict(self._cached_stats)

        if not self.is_connected() or self._db is None:
            return {
                "cloud_connected": False,
                "total_unique_approved": 0,
                "total_filtered_domains": 0,
                "status": "offline_fallback"
            }
        try:
            try:
                appr_count = self._db.approved_urls.estimated_document_count()
            except Exception:
                appr_count = self._db.approved_urls.count_documents({})

            try:
                filt_count = self._db.filtered_domains.estimated_document_count()
            except Exception:
                filt_count = self._db.filtered_domains.count_documents({})

            try:
                sess_count = self._db.search_sessions.estimated_document_count()
            except Exception:
                sess_count = self._db.search_sessions.count_documents({})

            stats = {
                "cloud_connected": True,
                "total_unique_approved": appr_count,
                "total_filtered_domains": filt_count,
                "total_sessions": sess_count,
                "database": "webscope_cache",
                "cluster": "cluster0.usvfwut.mongodb.net",
                "status": "connected"
            }
            MongoCacheStorage._cached_stats = stats
            MongoCacheStorage._last_stats_time = now
            return dict(stats)
        except Exception:
            return {
                "cloud_connected": False,
                "total_unique_approved": 0,
                "total_filtered_domains": 0,
                "status": "error"
            }
