'use client';
import { cn } from '@/core/ui';

interface SettingRowProps {
  label: string;
  description?: string;
  polish?: boolean;
  children: React.ReactNode;
  error?: string;
}

export function SettingRow({ label, description, polish, children, error }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-8 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {polish && (
            <span className="text-xs text-muted-foreground">[Polish]</span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
