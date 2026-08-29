'use client';

import React from 'react';
import { History } from 'lucide-react';

interface HeaderActionsProps {
  onHistoryClick: () => void;
  onClearClick?: () => void;
  historyCount?: number;
}

export function HeaderActions({ onHistoryClick }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2 relative">
      {/* History Modal Button */}
      <button
        type="button"
        onClick={onHistoryClick}
        className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted font-medium whitespace-nowrap transition-all h-7 gap-1.5 px-2.5 text-xs text-foreground shadow-xs"
      >
        <History className="h-3.5 w-3.5" />
        <span>History</span>
      </button>
    </div>
  );
}
