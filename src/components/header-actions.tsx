'use client';

import React, { useState, useEffect } from 'react';
import { History, Trash2, Download, Cloud, RefreshCw, CheckCircle2, FileSpreadsheet, FileCode } from 'lucide-react';

interface HeaderActionsProps {
  onHistoryClick: () => void;
  onClearClick: () => void;
  historyCount: number;
}

export function HeaderActions({ onHistoryClick, onClearClick, historyCount }: HeaderActionsProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [mongoCount, setMongoCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function checkCloudStatus() {
      try {
        const res = await fetch('/api/cache/stats');
        if (res.ok) {
          const data = await res.json();
          setCloudConnected(Boolean(data.cloud_connected));
          if (typeof data.mongodb_approved === 'number') {
            setMongoCount(data.mongodb_approved);
          }
        }
      } catch {
        setCloudConnected(false);
      }
    }
    checkCloudStatus();
    const interval = setInterval(checkCloudStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/cache/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCloudConnected(true);
        if (typeof data.total_in_mongo === 'number') {
          setMongoCount(data.total_in_mongo);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = (format: 'json' | 'csv') => {
    setShowExportMenu(false);
    window.open(`/api/cache/export?format=${format}`, '_blank');
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Cloud Status Badge */}
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        title={cloudConnected ? `MongoDB Atlas: Connected (${mongoCount !== null ? mongoCount : historyCount} cached unique records). Click to re-sync.` : "MongoDB Atlas: Disconnected. Click to retry sync."}
        className={`inline-flex items-center justify-center rounded-lg border font-medium whitespace-nowrap transition-all h-7 gap-1.5 px-2.5 text-xs ${
          cloudConnected
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
        }`}
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>{cloudConnected ? 'MongoDB Connected' : 'Connect MongoDB'}</span>
        {isSyncing ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          cloudConnected && <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        )}
      </button>

      {/* Export Cache Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted font-medium whitespace-nowrap transition-all h-7 gap-1.5 px-2.5 text-xs text-foreground shadow-xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Cache</span>
        </button>

        {showExportMenu && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl z-50 animate-in fade-in zoom-in-95">
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Download Cache Data
            </div>
            <button
              type="button"
              onClick={() => handleDownload('json')}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileCode className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">Download JSON</div>
                <div className="text-[10px] text-muted-foreground">Full data with domains & stats</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('csv')}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="font-medium">Download CSV</div>
                <div className="text-[10px] text-muted-foreground">All approved URLs & domains</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* History Modal Button */}
      <button
        type="button"
        onClick={onHistoryClick}
        className="inline-flex items-center justify-center rounded-lg border border-transparent font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground h-7 gap-1 px-2.5 text-xs"
      >
        <History className="h-3.5 w-3.5 mr-1" />
        History
      </button>

      {/* Clear Button */}
      {historyCount > 0 && (
        <button
          type="button"
          onClick={onClearClick}
          className="inline-flex items-center justify-center rounded-lg border border-transparent font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-destructive h-7 gap-1 px-2.5 text-xs text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </button>
      )}
    </div>
  );
}
