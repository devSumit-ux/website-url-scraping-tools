'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { SearchComposer } from '@/components/search/search-composer';
import { SearchProgress } from '@/components/search/search-progress';
import { SearchRequest, SearchResponse, SearchResult } from '@/lib/types';
import { 
  X, ShieldCheck, RotateCcw, Copy, Check, RefreshCw, 
  ArrowRight, Info, AlertTriangle, CheckCircle2, Ban, ExternalLink, Trash2, Database
} from 'lucide-react';
import dynamic from 'next/dynamic';

const HeaderActions = dynamic(() => import('@/components/header-actions').then(mod => ({ default: mod.HeaderActions })), { ssr: false });

export default function Home() {
  const [isSearching, setIsSearching] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [historyStats, setHistoryStats] = useState<{ total_unique: number; total_urls: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    status: string;
    candidates: number;
    processed: number;
    accepted: number;
    blocked: number;
    duplicates: number;
    error?: string;
    etaSeconds?: number;
  }>({
    status: 'queued',
    candidates: 0,
    processed: 0,
    accepted: 0,
    blocked: 0,
    duplicates: 0,
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; query: string; timestamp: number; count: number }>>([]);
  const [selectedQuery, setSelectedQuery] = useState('');
  const [lastSearchRequest, setLastSearchRequest] = useState<SearchRequest | null>(null);
  const currentQueryRef = useRef<string>('');

  // Browser Cache for Delivered and Filtered Domains
  const [cachedDelivered, setCachedDelivered] = useState<string[]>([]);
  const [cachedFiltered, setCachedFiltered] = useState<string[]>([]);
  const [momentaryInvalidCount, setMomentaryInvalidCount] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const extractRootDomain = (u: string): string => {
    if (!u) return '';
    let d = u.trim().toLowerCase();
    if (d.includes('://')) d = d.split('://')[1];
    d = d.split('/')[0].split('?')[0].split('#')[0];
    while (d.startsWith('www.')) d = d.slice(4);
    return d;
  };

  // Initialize and load browser cache
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('webscope-history');
      if (storedHistory) setHistory(JSON.parse(storedHistory));

      const storedDelivered = localStorage.getItem('webscope-cached-delivered-urls');
      if (storedDelivered) setCachedDelivered(JSON.parse(storedDelivered));

      const storedFiltered = localStorage.getItem('webscope-cached-filtered-domains');
      if (storedFiltered) setCachedFiltered(JSON.parse(storedFiltered));

      try { sessionStorage.removeItem('webscope-active-job'); } catch {}
    } catch {}
  }, []);

  const handleClearBrowserCache = () => {
    try {
      localStorage.removeItem('webscope-cached-delivered-urls');
      localStorage.removeItem('webscope-cached-filtered-domains');
      setCachedDelivered([]);
      setCachedFiltered([]);
      showToast('Browser URL cache cleared');
    } catch {}
  };

  const handleCancelSearch = useCallback(async () => {
    if (jobId) {
      try {
        fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {});
      } catch {}
    }
    setIsSearching(false);
    setJobId(null);
    setProgress({
      status: 'cancelled',
      candidates: 0,
      processed: 0,
      accepted: 0,
      blocked: 0,
      duplicates: 0,
    });
    try { sessionStorage.removeItem('webscope-active-job'); } catch {}
  }, [jobId]);

  const fetchHistoryStats = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryStats(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchHistoryStats();
  }, [fetchHistoryStats]);

  const handleClearHistoryLog = async () => {
    try {
      const res = await fetch('/api/history', { method: 'POST' });
      if (res.ok) {
        setHistoryStats({ total_unique: 0, total_urls: 0 });
        showToast('Persistent log reset');
      }
    } catch {}
  };

  const handleSearch = async (request: SearchRequest): Promise<SearchResponse> => {
    setIsSearching(true);
    setResults([]);
    setJobId(null);
    setMomentaryInvalidCount(0);
    setLastSearchRequest(request);
    currentQueryRef.current = request.query;

    // Combine browser cached delivered and filtered domains to guarantee zero duplicates & avoid re-filtering
    const excludedFromCache = Array.from(new Set([
      ...cachedDelivered.map(extractRootDomain),
      ...cachedFiltered.map(extractRootDomain),
      ...(request.excludeDomains || []).map(extractRootDomain)
    ])).filter(Boolean);

    const enrichedRequest: SearchRequest = {
      ...request,
      limit: request.limit || 30, // Default to 30 URLs for ultra-fast scraping
      excludeDomains: excludedFromCache,
    };

    setProgress({
      status: 'searching',
      candidates: 0,
      processed: 0,
      accepted: 0,
      blocked: 0,
      duplicates: 0,
      etaSeconds: undefined,
    });

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedRequest),
      });

      if (!res.ok) {
        throw new Error('Search failed to start');
      }

      const data: SearchResponse = await res.json();
      setJobId(data.jobId);

      pollJob(data.jobId, enrichedRequest.limit);
      return data;
    } catch (error) {
      setProgress({
        status: 'failed',
        candidates: 0,
        processed: 0,
        accepted: 0,
        blocked: 0,
        duplicates: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsSearching(false);
      throw error;
    }
  };

  const pollJob = async (jobId: string, requestedLimit: number = 30) => {
    const startTime = Date.now();
    let isPollingActive = true;
    let consecutiveNetworkErrors = 0;

    const poll = async () => {
      if (!isPollingActive) return;

      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          consecutiveNetworkErrors++;
          if (isPollingActive) setTimeout(poll, Math.min(2000, 400 + consecutiveNetworkErrors * 200));
          return;
        }

        consecutiveNetworkErrors = 0;
        const data = await res.json();
        const elapsed = (Date.now() - startTime) / 1000;

        if (data.status === 'completed' || data.status === 'partial' || (data.accepted >= requestedLimit && data.accepted > 0)) {
          isPollingActive = false;
          try { sessionStorage.removeItem('webscope-active-job'); } catch {}

          const blockedCount = data.blocked || Math.max(0, (data.processed || 0) - (data.accepted || 0));
          setMomentaryInvalidCount(blockedCount);

          setProgress(prev => ({
            status: 'completed',
            candidates: Math.max(prev.candidates, data.candidates || data.accepted || 0),
            processed: Math.max(prev.processed, data.processed || data.accepted || 0),
            accepted: Math.max(prev.accepted, data.accepted || 0),
            blocked: blockedCount,
            duplicates: data.duplicates || 0,
            etaSeconds: 0,
          }));

          // Resilient fetch loop with retry to ensure results list is fully loaded from backend
          let resultList: any[] = [];
          for (let attempt = 0; attempt < 12; attempt++) {
            try {
              const resultsRes = await fetch(`/api/jobs/${jobId}/results?limit=100000`);
              if (resultsRes.ok) {
                const resultsData = await resultsRes.json();
                const fetched = resultsData.results || [];
                if (fetched.length > 0) {
                  resultList = fetched;
                  break;
                }
              }
            } catch {}
            await new Promise(r => setTimeout(r, 150));
          }

          setResults(resultList);
          if (resultList.length > 0) {
            saveToHistory(currentQueryRef.current, resultList.length);
            fetchHistoryStats();

            // Cache delivered domains in browser storage so they are never repeated
            const newDelivered = resultList.map(r => formatProperUrl(r.url || r.domain)).filter(Boolean);
            setCachedDelivered(prev => {
              const updated = Array.from(new Set([...prev, ...newDelivered]));
              try { localStorage.setItem('webscope-cached-delivered-urls', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          setIsSearching(false);
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled') {
          isPollingActive = false;
          try { sessionStorage.removeItem('webscope-active-job'); } catch {}

          setProgress(prev => ({
            ...prev,
            status: data.status,
            error: data.error || 'Search failed',
          }));
          setIsSearching(false);
          return;
        }

        // Monotonically updated live workload metrics
        const liveAccepted = data.accepted || 0;
        const liveProcessed = data.processed || 0;
        const liveCandidates = Math.max(data.candidates || 0, liveProcessed, liveAccepted);
        const remainingNeeded = Math.max(0, requestedLimit - liveAccepted);

        let scriptLoadEta: number | undefined = undefined;
        if (data.etaSeconds !== undefined && data.etaSeconds !== null && data.etaSeconds > 0) {
          scriptLoadEta = data.etaSeconds;
        } else if (elapsed > 1.0 && (liveAccepted > 0 || liveProcessed > 0)) {
          const currentRate = liveAccepted > 0 
            ? (liveAccepted / elapsed) 
            : (liveProcessed / elapsed * 0.4);
          if (currentRate > 0.05) {
            scriptLoadEta = Math.ceil(remainingNeeded / currentRate);
          }
        }

        const filteredCount = Math.max(0, liveProcessed - liveAccepted);
        setMomentaryInvalidCount(filteredCount);

        setProgress(prev => ({
          status: 'searching',
          candidates: Math.max(prev.candidates, liveCandidates),
          processed: Math.max(prev.processed, liveProcessed),
          accepted: Math.max(prev.accepted, liveAccepted),
          blocked: Math.max(prev.blocked, filteredCount),
          duplicates: Math.max(prev.duplicates, data.duplicates || 0),
          error: data.error,
          etaSeconds: scriptLoadEta !== undefined ? scriptLoadEta : prev.etaSeconds,
        }));

        if (isPollingActive) {
          setTimeout(poll, 300);
        }
      } catch (error) {
        consecutiveNetworkErrors++;
        if (isPollingActive) {
          setTimeout(poll, Math.min(2500, 600 + consecutiveNetworkErrors * 400));
        }
      }
    };

    poll();
  };

  const formatProperUrl = (urlOrDomain: string): string => {
    if (!urlOrDomain) return '';
    let d = urlOrDomain.trim().toLowerCase();
    if (d.includes('://')) {
      d = d.split('://')[1];
    }
    d = d.split('/')[0].split('?')[0].split('#')[0];
    while (d.startsWith('www.')) {
      d = d.slice(4);
    }
    if (!d || d.includes('..') || d.includes('--')) return '';
    return `https://www.${d}`;
  };

  const handleCopy = async (url: string) => {
    const cleanUrl = formatProperUrl(url);
    await navigator.clipboard.writeText(cleanUrl);
    showToast('Copied 1 URL to clipboard');
  };

  const handleCopyAll = async () => {
    const urls = results.map(r => formatProperUrl(r.url || r.domain)).filter(Boolean).join('\n');
    await navigator.clipboard.writeText(urls);
    showToast(`Copied all ${results.length} URLs to clipboard`);
  };

  const handleTriggerNewSearch = useCallback(async () => {
    if (isSearching) return;
    const req: SearchRequest = lastSearchRequest || {
      query: selectedQuery || '',
      searchType: 'auto',
      limit: 30,
      domainLimit: 1,
      diversityEnabled: true,
    };
    showToast('Starting next search...');
    await handleSearch(req);
  }, [isSearching, lastSearchRequest, selectedQuery]);

  const handleCopyAllAndNext = useCallback(async () => {
    if (results.length > 0) {
      const urls = results.map(r => formatProperUrl(r.url || r.domain)).filter(Boolean).join('\n');
      await navigator.clipboard.writeText(urls);
      showToast(`Copied ${results.length} URLs! Finding next 30 URLs...`);
    }
    const req: SearchRequest = lastSearchRequest || {
      query: selectedQuery || '',
      searchType: 'auto',
      limit: 30,
      domainLimit: 1,
      diversityEnabled: true,
    };
    await handleSearch(req);
  }, [results, lastSearchRequest, selectedQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'End' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (results.length > 0 && !isSearching) {
          handleCopyAllAndNext();
        } else if (!isSearching) {
          handleTriggerNewSearch();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, isSearching, handleCopyAllAndNext, handleTriggerNewSearch]);

  const handleExport = (format: string) => {
    const content = generateExport(results, format);
    const mimeType = format === 'excel' ? 'text/csv;charset=utf-8;' : (format === 'csv' ? 'text/csv' : 'text/plain');
    const ext = format === 'excel' ? 'csv' : format;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webscope-results.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToHistory = useCallback((query: string, count: number) => {
    setHistory(prev => {
      const next = [{ id: crypto.randomUUID(), query, timestamp: Date.now(), count }, ...prev.filter(h => h.query !== query)].slice(0, 100);
      try {
        localStorage.setItem('webscope-history', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground" suppressHydrationWarning>
      <header className="border-b border-border bg-card/40" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" suppressHydrationWarning>
          <div className="flex items-center gap-6" suppressHydrationWarning>
            <Link href="/" className="flex items-center gap-2.5" suppressHydrationWarning>
              <img src="/logo.svg" alt="WebScope" className="h-7 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-5 text-xs font-medium tracking-wide uppercase text-muted-foreground" suppressHydrationWarning>
              <Link href="/" className="text-foreground transition-colors hover:text-foreground">URL Scraper</Link>
              <button 
                type="button" 
                onClick={() => setShowRules(!showRules)} 
                className="hover:text-foreground transition-colors"
              >
                Upload Rules & Compliance
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2" suppressHydrationWarning>
            <HeaderActions
              onHistoryClick={() => setShowHistory(!showHistory)}
              onClearClick={() => {
                localStorage.removeItem('webscope-history');
                setHistory([]);
                showToast('History cleared');
              }}
              historyCount={history.length}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {!jobId && !isSearching && (
          <div className="py-14 px-6">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight mb-3 text-foreground">
                Verified Web URL Engine
              </h1>
              <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Autonomous multi-source discovery strictly adhering to URL upload standards, zero subdomains, no redirection, and automatic browser deduplication.
              </p>
            </div>

            {/* Browser Cache & History Deduplication Banner */}
            <div className="max-w-xl mx-auto mb-6 p-3 rounded-md bg-muted/40 border border-border/80 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">{cachedDelivered.length.toLocaleString()}</strong> URLs cached in browser · <strong className="text-foreground">{historyStats?.total_unique || 0}</strong> logged in backend
                </span>
              </div>
              <div className="flex items-center gap-3">
                {cachedDelivered.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBrowserCache}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Clear Browser Cache
                  </button>
                )}
                {historyStats && historyStats.total_unique > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistoryLog}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Reset DB Log
                  </button>
                )}
              </div>
            </div>

            <SearchComposer
              onSearch={handleSearch}
              isSearching={isSearching}
              initialQuery={selectedQuery}
              initialRequest={lastSearchRequest}
            />

            {/* Official Rules & Regulations Card */}
            <div className="mt-12 max-w-3xl mx-auto">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
                      Rules & Regulations for URL Uploading
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">Compliance Standards</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Ban className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span><strong>Redirected sites not accepted:</strong> Any site redirecting to external domains or subdomains is filtered out.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Ban className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span><strong>Subdomains not accepted:</strong> Only apex root domains formatted as <code className="text-foreground">https://www.domainName.com</code>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Ban className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span><strong>Numeric values not accepted in URL:</strong> Domain names containing numeric digits (0–9) are prohibited.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Proper URL format:</strong> Must start with <code className="text-foreground">http://www.</code> or <code className="text-foreground">https://www.</code> followed by valid apex domain.</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Valid content required:</strong> Garbage, parked, or empty pages without content are strictly rejected.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Ban className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span><strong>No contiguous or series pattern URLs:</strong> Sequential alphabet/numeric patterns (e.g. xyza, xyzb, xyzc) are blocked.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Accessible & live response:</strong> URLs must respond with 200 OK without request timeouts.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Instant Invalid Count:</strong> Invalid URL counts are shown at that moment only and not stored permanently in the system.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(isSearching || jobId) && (
          <div className="py-10 px-6">
            <SearchProgress
              status={progress.status}
              candidates={progress.candidates}
              processed={progress.processed}
              accepted={progress.accepted}
              blocked={progress.blocked}
              duplicates={progress.duplicates}
              error={progress.error}
              etaSeconds={progress.etaSeconds}
              onCancel={handleCancelSearch}
            />

            {results.length > 0 && (
              <div className="max-w-3xl mx-auto mt-6">
                {/* Top Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 p-3.5 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      {results.length.toLocaleString()} {results.length === 1 ? 'URL' : 'URLs'} Verified
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Primary Highlighted Action: Copy & Next */}
                    <button
                      type="button"
                      onClick={handleCopyAllAndNext}
                      title="Copy all URLs to clipboard and automatically start scraping next 30 URLs (Shortcut: Press End key)"
                      className="inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-semibold shadow-md ring-2 ring-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy & Next Batch</span>
                      <span className="px-1 py-0.5 rounded bg-white/20 text-[10px] font-mono leading-none">End</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground px-3.5 py-1.5 text-xs font-medium hover:bg-secondary/80 transition-all gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy All ({results.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerNewSearch}
                      title="Scrape next batch without copying"
                      className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted hover:text-foreground transition-colors gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Next Search
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('excel')}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => { setJobId(null); setResults([]); }}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground hover:text-foreground px-2 py-1.5 text-xs font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {results.map((result, idx) => (
                    <div key={result.id} className="group">
                      <div className="p-3.5 rounded-lg border border-border bg-card/60 hover:bg-muted/30 transition-all space-y-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono text-muted-foreground">#{idx + 1}</span>
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline truncate">
                                {result.url}
                              </a>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{result.domain}</span>
                            </div>
                            {result.title && result.title !== result.domain && (
                              <p className="text-xs font-medium text-foreground mt-1 truncate">{result.title}</p>
                            )}
                            {result.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCopy(result.url)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded border border-border hover:bg-secondary transition-colors shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-6 flex justify-center gap-3 flex-wrap">
                  {/* Primary Highlighted Action: Copy & Next */}
                  <button
                    type="button"
                    onClick={handleCopyAllAndNext}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold shadow-lg ring-2 ring-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy & Next Batch</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/20 text-xs font-mono">End</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/80 gap-2 shadow-sm"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy All ({results.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerNewSearch}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Next Search
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 bg-card/20">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-muted-foreground">
          Verified Web Engine — Strict Apex Domain Validation, Zero Redirections & Rapid Scraper.
        </div>
      </footer>

      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowHistory(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Search History</h2>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto h-full">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No search history yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map(item => (
                    <div key={item.id} className="p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                      <p className="font-medium truncate">{item.query || 'Broad Multi-TLD Discovery'}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        <span>·</span>
                        <span>{item.count} results</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateExport(results: SearchResult[], format: string): string {
  const cleanUrl = (u: string) => {
    if (!u) return '';
    let d = u.trim().toLowerCase();
    if (d.includes('://')) {
      d = d.split('://')[1];
    }
    d = d.split('/')[0].split('?')[0].split('#')[0];
    while (d.startsWith('www.')) {
      d = d.slice(4);
    }
    return `https://www.${d}`;
  };
  switch (format) {
    case 'excel':
      // UTF-8 BOM for Microsoft Excel compatibility
      const excelHeaders = '\uFEFFWebsite URL,Domain,Title,Description\n';
      const excelRows = results.map(r =>
        `"${cleanUrl(r.url)}","${r.domain}","${(r.title || '').replace(/"/g, '""')}","${(r.description || '').replace(/"/g, '""')}"`
      ).join('\n');
      return excelHeaders + excelRows;
    case 'csv':
      const headers = 'url,domain,title,description\n';
      const rows = results.map(r =>
        `"${cleanUrl(r.url)}","${r.domain}","${(r.title || '').replace(/"/g, '""')}","${(r.description || '').replace(/"/g, '""')}"`
      ).join('\n');
      return headers + rows;
    case 'json':
      const cleaned = results.map(r => ({ ...r, url: cleanUrl(r.url) }));
      return JSON.stringify(cleaned, null, 2);
    case 'txt':
      return results.map(r => cleanUrl(r.url)).join('\n');
    case 'md':
      return results.map(r => `[${r.title || r.domain}](${cleanUrl(r.url)}) - ${r.description || ''}`).join('\n');
    default:
      return results.map(r => cleanUrl(r.url)).join('\n');
  }
}
