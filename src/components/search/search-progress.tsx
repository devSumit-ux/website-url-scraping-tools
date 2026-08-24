'use client';

import { Search, Loader2, Clock, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SearchProgressProps {
  status: string;
  candidates: number;
  processed: number;
  accepted: number;
  blocked: number;
  duplicates: number;
  error?: string;
  etaSeconds?: number;
  onCancel?: () => void;
}

export function SearchProgress({
  status,
  candidates,
  processed,
  accepted,
  blocked,
  duplicates,
  error,
  etaSeconds,
  onCancel,
}: SearchProgressProps) {
  const getStatusMessage = () => {
    switch (status) {
      case 'queued':
        return 'Waiting to start...';
      case 'searching':
        return 'Finding relevant pages...';
      case 'validating':
        return 'Validating URLs...';
      case 'filtering':
        return 'Filtering results...';
      case 'ranking':
        return 'Ranking results...';
      case 'completed':
        return 'Search complete';
      case 'partial':
        return 'Search partial';
      case 'failed':
        return error || 'Search failed';
      case 'cancelled':
        return 'Search cancelled';
      default:
        return 'Processing...';
    }
  };

  const progress = candidates > 0 ? Math.min(100, Math.round((processed / candidates) * 100)) : 0;
  const formatEta = (seconds?: number) => {
    if (seconds === undefined || seconds === null || !isFinite(seconds)) return 'Calculating...';
    if (seconds <= 0) return 'Almost done';
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.ceil(seconds % 60);
      return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    return `~${hours}h ${mins}m`;
  };

  return (
    <Card className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {status === 'completed' ? (
            <Search className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          <div>
            <h3 className="font-semibold">{getStatusMessage()}</h3>
            {status !== 'completed' && status !== 'failed' && status !== 'cancelled' && (
              <p className="text-sm text-muted-foreground">This may take a few moments</p>
            )}
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel / Reset
          </button>
        )}
      </div>

      {status !== 'failed' && status !== 'cancelled' && (
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Discovered</p>
              <p className="font-semibold text-lg">{candidates}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Checked</p>
              <p className="font-semibold text-lg">{processed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Accepted</p>
              <p className="font-semibold text-lg text-green-600">{accepted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Filtered</p>
              <p className="font-semibold text-lg">{blocked + duplicates}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ETA</p>
              <p className="font-semibold text-lg">{formatEta(etaSeconds)}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}
    </Card>
  );
}
