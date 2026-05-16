'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
} from '@/core/ui';
import type { Model, ModelLayer } from '../db/schema';

const LAYER_INFO: Record<ModelLayer, { prefix: string[]; description: string }> = {
  staging: { prefix: ['stg_'], description: '1:1 mirror of source with basic cleaning' },
  intermediate: { prefix: ['int_'], description: 'Joins, business logic, transformations' },
  marts: { prefix: ['dim_', 'fct_'], description: 'Final consumable dimensional tables' },
};

function detectLayer(name: string): ModelLayer | null {
  if (name.startsWith('stg_')) return 'staging';
  if (name.startsWith('int_')) return 'intermediate';
  if (name.startsWith('dim_') || name.startsWith('fct_')) return 'marts';
  return null;
}

interface Props {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (model: Model) => void;
}

export function NewModelDialog({ workspaceId, open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [layer, setLayer] = useState<ModelLayer>('staging');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedLayer = detectLayer(name);
  const activeLayer = detectedLayer ?? layer;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/model/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), layer: activeLayer }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to create model');
        return;
      }
      const model = (await res.json()) as Model;
      setName('');
      setLayer('staging');
      onCreated(model);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && /^[a-z][a-z0-9_]*$/.test(name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Model</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="model-name" className="text-sm font-medium">Model name</label>
            <Input
              id="model-name"
              placeholder='e.g. "stg_orders", "dim_customer", "fct_sales"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isValid && handleSubmit()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Prefix: <code>stg_</code> staging · <code>int_</code> intermediate ·{' '}
              <code>dim_</code>/<code>fct_</code> marts
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Layer</label>
            <div className="flex gap-2">
              {(['staging', 'intermediate', 'marts'] as ModelLayer[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs transition-colors ${
                    activeLayer === l
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {activeLayer && (
              <p className="text-xs text-muted-foreground">{LAYER_INFO[activeLayer].description}</p>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? 'Creating…' : 'Create model →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
