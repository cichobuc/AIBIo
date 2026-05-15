'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/core/ui/alert-dialog';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import type { DataSource } from '@/core/types/workspace';

type Props = {
  source: DataSource;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function RemoveSourceDialog({ source, open, onClose, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  const confirmed = typed === source.name;

  const handleConfirm = async () => {
    if (!confirmed) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setTyped('');
    }
  };

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &quot;{source.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the connection configuration. Your source database is unaffected —
            no changes were made to it (read-only contract).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-foreground">{source.name}</strong> to confirm:
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={source.name}
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!confirmed || loading}
            onClick={handleConfirm}
          >
            {loading ? 'Removing...' : 'Remove source'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
