'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PiiTypeRadios } from './PiiTypeRadios';
import type { PiiSubtype } from './PiiTypeRadios';

type PiiClassification = 'none' | 'pii' | 'sensitive';

const LAYER_OPTIONS: { value: PiiClassification; label: string; desc: string; cls: string }[] = [
  { value: 'none', label: 'L1 — Allowed', desc: 'No restriction', cls: 'text-layer-1' },
  { value: 'sensitive', label: 'L2 — Sensitive', desc: 'Reference samples only', cls: 'text-layer-2' },
  { value: 'pii', label: 'L3 — PII blocked', desc: 'Masked in all AI output', cls: 'text-layer-3' },
];

export type ClassifyColumnTarget = {
  workspaceId: string;
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiClassification: PiiClassification | null;
  piiSubtype: PiiSubtype | null;
  suggestion?: {
    classification: PiiClassification;
    subtype: PiiSubtype | null;
    reason: string;
  } | null;
};

type Props = {
  target: ClassifyColumnTarget | null;
  onClose: () => void;
};

export function ClassifyColumnSheet({ target, onClose }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [classification, setClassification] = useState<PiiClassification>(
    target?.piiClassification ?? 'none',
  );
  const [subtype, setSubtype] = useState<PiiSubtype | null>(target?.piiSubtype ?? null);
  const [saving, setSaving] = useState(false);

  const open = target !== null;

  useEffect(() => {
    if (target) {
      setClassification(target.piiClassification ?? 'none');
      setSubtype(target.piiSubtype ?? null);
    }
  }, [target]);

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);
    await fetch('/api/govern/column-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: target.workspaceId,
        dataSourceId: target.dataSourceId,
        tableName: target.tableName,
        columnName: target.columnName,
        piiClassification: classification,
        piiSubtype: classification === 'none' ? undefined : subtype ?? undefined,
        setBy: 'user',
      }),
    });
    setSaving(false);
    startTransition(() => router.refresh());
    onClose();
  };

  const resetToTarget = () => {
    setClassification(target?.piiClassification ?? 'none');
    setSubtype(target?.piiSubtype ?? null);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="text-sm font-medium">
            Classify column
          </SheetTitle>
          {target && (
            <p className="text-xs font-mono text-muted-foreground">
              {target.tableName}.<span className="text-foreground">{target.columnName}</span>
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
          {target?.suggestion && (
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span>AI suggested: {target.suggestion.reason}</span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GDPR layer</p>
            {LAYER_OPTIONS.map(({ value, label, desc, cls }) => (
              <label key={value} className="flex items-start gap-2 cursor-pointer py-0.5">
                <input
                  type="radio"
                  name="gdpr-layer"
                  value={value}
                  checked={classification === value}
                  onChange={() => {
                    setClassification(value);
                    if (value === 'none') setSubtype(null);
                  }}
                  className="h-3.5 w-3.5 mt-0.5 accent-primary"
                />
                <span className="text-xs">
                  <span className={`font-medium ${cls}`}>{label}</span>
                  <span className="text-muted-foreground ml-1.5">{desc}</span>
                  {target?.suggestion?.classification === value && (
                    <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1">← suggested</Badge>
                  )}
                </span>
              </label>
            ))}
          </div>

          {classification !== 'none' && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">PII type</p>
              <PiiTypeRadios
                value={subtype}
                onChange={setSubtype}
                suggestedSubtype={target?.suggestion?.subtype}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { resetToTarget(); onClose(); }}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs flex-1" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save classification'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
