/**
 * Direct High-Speed Python Scraping Engine API Client
 */

const PYTHON_ENGINE_URL = (process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export async function getPythonEngineUrl(): Promise<string> {
  return PYTHON_ENGINE_URL;
}

export async function fetchPythonScraper(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = `${PYTHON_ENGINE_URL}${cleanPath}`;

  const res = await fetch(targetUrl, {
    ...init,
    cache: 'no-store',
  });
  return res;
}
