/**
 * Unified Python Scraping Engine API Client
 * Automatically discovers active port (8000, 8001, or custom PYTHON_SCRAPER_URL)
 */

const DEFAULT_PORTS = [8000, 8001, 8080];
let activeBaseUrl: string | null = null;

export async function getPythonEngineUrl(): Promise<string> {
  const envUrl = process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  if (activeBaseUrl) {
    return activeBaseUrl;
  }

  // Probe default ports
  for (const port of DEFAULT_PORTS) {
    const candidate = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${candidate}/health`, {
        signal: AbortSignal.timeout(600),
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === 'healthy') {
          activeBaseUrl = candidate;
          return candidate;
        }
      }
    } catch {}
  }

  return 'http://127.0.0.1:8000';
}

export async function fetchPythonScraper(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = await getPythonEngineUrl();

  try {
    const res = await fetch(`${baseUrl}${cleanPath}`, {
      ...init,
      cache: 'no-store',
    });
    return res;
  } catch (err) {
    // If failed, reset cached URL and try fallback port once
    activeBaseUrl = null;
    for (const port of DEFAULT_PORTS) {
      const candidate = `http://127.0.0.1:${port}`;
      if (candidate === baseUrl) continue;
      try {
        const fallbackRes = await fetch(`${candidate}${cleanPath}`, {
          ...init,
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        });
        if (fallbackRes.ok) {
          activeBaseUrl = candidate;
          return fallbackRes;
        }
      } catch {}
    }
    throw err;
  }
}
