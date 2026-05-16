'use client';
import { useState } from 'react';
import { Input, cn } from '@/core/ui';

interface SettingNumberProps {
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onError?: (msg: string | null) => void;
}

export function SettingNumber({ value, min, max, suffix, disabled, onChange, onError }: SettingNumberProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [invalid, setInvalid] = useState(false);

  function handleChange(raw: string) {
    setLocalValue(raw);
    const n = Number(raw);
    if (!Number.isInteger(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
      setInvalid(true);
      onError?.(`Must be ${min !== undefined ? `≥ ${min}` : ''}${min !== undefined && max !== undefined ? ' and ' : ''}${max !== undefined ? `≤ ${max}` : ''}`);
      return;
    }
    setInvalid(false);
    onError?.(null);
    onChange(n);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={localValue}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        className={cn('h-8 w-20 text-right text-sm', invalid && 'border-destructive focus-visible:ring-destructive')}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}
