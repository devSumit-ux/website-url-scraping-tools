import http from 'node:http';

const PYTHON_ENGINE_URL = (process.env.PYTHON_SCRAPER_URL || process.env.PYTHON_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const parsedUrl = new URL(PYTHON_ENGINE_URL);
const ENGINE_HOST = parsedUrl.hostname || '127.0.0.1';
const ENGINE_PORT = parseInt(parsedUrl.port || '8000', 10);

export async function getPythonEngineUrl(): Promise<string> {
  return PYTHON_ENGINE_URL;
}

/**
 * Ultra-fast, zero-pool-deadlock IPC client for Python scraping engine
 */
export async function fetchPythonScraper(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const method = (init?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Connection': 'close',
  };

  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([k, v]) => { headers[k] = v; });
    } else {
      Object.assign(headers, init.headers);
    }
  }

  const bodyData = init?.body ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : null;
  if (bodyData) {
    headers['Content-Length'] = Buffer.byteLength(bodyData).toString();
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  return new Promise<Response>((resolve, reject) => {
    const req = http.request({
      hostname: ENGINE_HOST,
      port: ENGINE_PORT,
      path: cleanPath,
      method,
      headers,
      agent: false,
      timeout: 30000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        const resHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) {
            if (Array.isArray(v)) {
              v.forEach((val) => resHeaders.append(k, val));
            } else {
              resHeaders.set(k, v);
            }
          }
        }
        resolve(new Response(bodyBuffer, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || 'OK',
          headers: resHeaders,
        }));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout connecting to Python scraper at ${ENGINE_HOST}:${ENGINE_PORT}${cleanPath}`));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}
