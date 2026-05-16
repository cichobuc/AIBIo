'use client';

import { useState } from 'react';
import { Input } from '@/core/ui/input';

export type PiiSubtype = 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other';

const SUBTYPES: { value: PiiSubtype; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'name', label: 'Name' },
  { value: 'address', label: 'Address' },
  { value: 'national_id', label: 'National ID' },
  { value: 'date_of_birth', label: 'Date of birth' },
  { value: 'ip', label: 'IP address' },
  { value: 'iban', label: 'IBAN' },
  { value: 'other', label: 'Other' },
];

type Props = {
  value: PiiSubtype | null;
  onChange: (v: PiiSubtype | null) => void;
  suggestedSubtype?: PiiSubtype | null;
};

export function PiiTypeRadios({ value, onChange, suggestedSubtype }: Props) {
  const [otherText, setOtherText] = useState('');

  return (
    <div className="space-y-1">
      {SUBTYPES.map(({ value: v, label }) => (
        <label key={v} className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="radio"
            name="pii-subtype"
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span className="text-xs flex items-center gap-1.5">
            {label}
            {suggestedSubtype === v && (
              <span className="text-[10px] text-muted-foreground">← suggested</span>
            )}
          </span>
        </label>
      ))}
      {value === 'other' && (
        <Input
          className="h-7 text-xs mt-1 ml-5"
          placeholder="Describe..."
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
        />
      )}
    </div>
  );
}
