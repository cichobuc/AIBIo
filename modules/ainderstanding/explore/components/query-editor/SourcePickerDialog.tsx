'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui';
import { useState, useEffect } from 'react';
import type { ExploreSource } from '../../lib/explore-data';

type Props = {
  open: boolean;
  sources: ExploreSource[];
  onConfirm: (sourceId: string) => void;
  onClose: () => void;
};

export function SourcePickerDialog({ open, sources, onConfirm, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(sources[0]?.id ?? '');

  useEffect(() => {
    setSelectedId(sources[0]?.id ?? '');
  }, [sources]);

  const handleConfirm = () => {
    if (selectedId) onConfirm(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">New Query</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Select a data source for this query session:</p>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Pick a source…" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs h-7" disabled={!selectedId} onClick={handleConfirm}>
              Open Editor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
