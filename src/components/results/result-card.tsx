'use client';

import { SearchResult } from '@/lib/types';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface ResultCardProps {
  result: SearchResult;
  onCopy: (url: string) => void;
}

export function ResultCard({ result, onCopy }: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const clean = (result.url || '').replace(/\/+$/, '');
    await onCopy(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline truncate block"
          >
            {result.url}
          </a>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span className="truncate">{result.domain}</span>
            {result.contentType && result.contentType !== 'page' && (
              <Badge variant="secondary" className="text-xs h-5">
                {result.contentType}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Card>
  );
}
