'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import type { PermissionTierValue } from '@/modules/ainderstanding/govern/db/schema';

const TIER_LABELS: Record<PermissionTierValue, string> = {
  metadata_only: 'Metadata only',
  with_reference_samples: '+ Reference samples',
  with_full_samples: '+ Full samples',
  with_query_results: '+ Query results',
};

const TIERS = Object.keys(TIER_LABELS) as PermissionTierValue[];

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (tableName: string, tier: PermissionTierValue) => void;
  existingTables: string[];
};

export function TableOverrideDialog({ open, onClose, onSave, existingTables }: Props) {
  const [tableName, setTableName] = useState('');
  const [tier, setTier] = useState<PermissionTierValue>('metadata_only');
  const [error, setError] = useState('');

  const handleSave = () => {
    const name = tableName.trim();
    if (!name) { setError('Table name is required'); return; }
    if (existingTables.includes(name)) { setError(`Override for "${name}" already exists`); return; }
    onSave(name, tier);
    setTableName('');
    setTier('metadata_only');
    setError('');
  };

  const handleClose = () => {
    setTableName('');
    setTier('metadata_only');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Add table override</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Table name</label>
            <Input
              className="h-8 text-xs font-mono"
              placeholder="e.g. invoices"
              value={tableName}
              onChange={(e) => { setTableName(e.target.value); setError(''); }}
            />
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Override tier</label>
            <Select value={tier} onValueChange={(v) => setTier(v as PermissionTierValue)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{TIER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Add override</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
