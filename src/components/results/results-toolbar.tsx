'use client';

import { Copy, Download, Save, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ResultsToolbarProps {
  total: number;
  selectedCount: number;
  onCopyAll: () => void;
  onExport: (format: string) => void;
  onSave: () => void;
}

export function ResultsToolbar({
  total,
  selectedCount,
  onCopyAll,
  onExport,
  onSave,
}: ResultsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">
          {total.toLocaleString()} {total === 1 ? 'URL' : 'URLs'}
        </h2>
        {selectedCount > 0 && (
          <Badge variant="secondary">{selectedCount} selected</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCopyAll}>
          <Copy className="h-4 w-4 mr-2" />
          Copy all
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('json')}>
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('txt')}>
              Export as TXT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('md')}>
              Export as Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>

        <Button variant="ghost" size="icon">
          <Filter className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
