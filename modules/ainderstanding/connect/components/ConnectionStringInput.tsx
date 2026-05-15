'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/core/ui/textarea';
import { parseConnectionString } from '@/modules/ainderstanding/connect/lib/connection-string-parser';
import type { DbDriver } from '@/core/types/workspace';

type Props = {
  value: string;
  onChange: (v: string) => void;
  dbType: DbDriver;
};

export function ConnectionStringInput({ value, onChange, dbType }: Props) {
  const [preview, setPreview] = useState<Record<string, string | number>>({});
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!value.trim()) {
        setPreview({});
        setParseError(false);
        return;
      }
      try {
        const parsed = parseConnectionString(value, dbType);
        const nonEmpty: Record<string, string | number> = {};
        if (parsed.host) nonEmpty['host'] = parsed.host;
        if (parsed.port) nonEmpty['port'] = parsed.port;
        if (parsed.database) nonEmpty['db'] = parsed.database;
        if (parsed.user) nonEmpty['user'] = parsed.user;
        setPreview(nonEmpty);
        setParseError(Object.keys(nonEmpty).length === 0);
      } catch {
        setPreview({});
        setParseError(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, dbType]);

  const hasPreview = Object.keys(preview).length > 0;

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${dbType === 'postgres' ? 'postgresql' : dbType}://user:password@host:port/database`}
        rows={3}
        className="font-mono text-xs"
        spellCheck={false}
      />
      {hasPreview && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-2 text-green-400">Parsed:</span>
          {Object.entries(preview).map(([k, v]) => (
            <span key={k} className="mr-3">
              <span className="text-foreground/70">{k}:</span> {v}
            </span>
          ))}
        </div>
      )}
      {parseError && value.trim() && (
        <p className="text-xs text-red-400">Could not parse connection string for {dbType}.</p>
      )}
    </div>
  );
}
