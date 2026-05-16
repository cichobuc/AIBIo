'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Button } from '@/core/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import type { PiiInventoryRow } from './PIIInventoryDashboard';

type PiiClassification = 'none' | 'pii' | 'sensitive';
type PiiSubtype = 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other';

const CLASS_LABELS: Record<PiiClassification, string> = {
  none: 'Allowed (L1)',
  sensitive: 'Sensitive (L2)',
  pii: 'PII — blocked (L3)',
};

const SUBTYPE_LABELS: Record<PiiSubtype, string> = {
  email: 'Email', phone: 'Phone', national_id: 'National ID', address: 'Address',
  ip: 'IP address', name: 'Name', date_of_birth: 'Date of birth', iban: 'IBAN', other: 'Other',
};

type RowState = { classification: PiiClassification; subtype: PiiSubtype | '' };

type Props = {
  workspaceId: string;
  open: boolean;
  rows: PiiInventoryRow[];
  onClose: () => void;
};

export function BulkClassifySheet({ workspaceId, open, rows, onClose }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [states, setStates] = useState<RowState[]>(() =>
    rows.map((r) => ({
      classification: (r.piiClassification ?? 'none') as PiiClassification,
      subtype: (r.piiSubtype ?? '') as PiiSubtype | '',
    })),
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<RowState>) =>
    setStates((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    setSaving(true);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const state = states[i]!;
      await fetch('/api/govern/column-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          dataSourceId: row.dataSourceId,
          tableName: row.tableName,
          columnName: row.columnName,
          piiClassification: state.classification,
          piiSubtype: state.classification !== 'none' && state.subtype ? state.subtype : undefined,
          setBy: 'user',
        }),
      });
    }
    setSaving(false);
    startTransition(() => router.refresh());
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-96 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="text-sm font-medium">
            Bulk classify ({rows.length} column{rows.length !== 1 ? 's' : ''})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {rows.map((row, i) => {
            const state = states[i]!;
            return (
              <div key={i} className="border rounded-md px-3 py-2 space-y-2">
                <p className="text-xs font-mono">
                  {row.tableName}.<span className="text-destructive">{row.columnName}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={state.classification}
                    onValueChange={(v) => update(i, { classification: v as PiiClassification, subtype: v === 'none' ? '' : state.subtype })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CLASS_LABELS) as [PiiClassification, string][]).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state.classification !== 'none' && (
                    <Select
                      value={state.subtype}
                      onValueChange={(v) => update(i, { subtype: v as PiiSubtype | '' })}
                    >
                      <SelectTrigger className="h-7 text-xs w-32">
                        <SelectValue placeholder="Subtype" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(SUBTYPE_LABELS) as [PiiSubtype, string][]).map(([k, label]) => (
                          <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-xs flex-1" onClick={() => void handleSave()} disabled={saving}>
            {saving ? `Saving ${rows.length}…` : `Save all classifications`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
