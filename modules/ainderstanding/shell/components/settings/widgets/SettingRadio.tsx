'use client';
import { cn } from '@/core/ui';

interface SettingRadioOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SettingRadioProps<T extends string> {
  name: string;
  value: T;
  options: SettingRadioOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

export function SettingRadio<T extends string>({ name, value, options, disabled, onChange }: SettingRadioProps<T>) {
  return (
    <div className="flex items-center gap-4">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex items-center gap-1.5 text-sm cursor-pointer',
            (disabled || opt.disabled) && 'cursor-not-allowed opacity-50',
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={disabled || opt.disabled}
            onChange={() => onChange(opt.value)}
            className="accent-primary"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
