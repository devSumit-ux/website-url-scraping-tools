'use client';

import React, { useState } from 'react';
import { History, Download, FileSpreadsheet, FileCode } from 'lucide-react';

interface HeaderActionsProps {
  onHistoryClick: () => void;
  onClearClick?: () => void;
  historyCount?: number;
}

export function HeaderActions({ onHistoryClick }: HeaderActionsProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleDownload = (format: 'json' | 'csv') => {
    setShowExportMenu(false);
    window.open(`/api/cache/export?format=${format}`, '_blank');
  };

  return (
    <div className="flex items-center gap-2 relative">
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
    </div>
  );
}
