'use client';

import { History, Trash2 } from 'lucide-react';

interface HeaderActionsProps {
  onHistoryClick: () => void;
  onClearClick: () => void;
  historyCount: number;
}

export function HeaderActions({ onHistoryClick, onClearClick, historyCount }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onHistoryClick}
        className="inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-ring/50 hover:bg-muted hover:text-foreground h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-sm"
      >
        <History className="h-4 w-4 mr-2" />
        History
      </button>
      {historyCount > 0 && (
        <button
          type="button"
          onClick={onClearClick}
          className="inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-ring/50 hover:bg-muted hover:text-destructive h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-sm text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </button>
      )}
    </div>
  );
}
