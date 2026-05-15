'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/core/ui/sheet';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { SecretField } from './SecretField';
import { ConnectionStringInput } from './ConnectionStringInput';
import { TestConnectionPanel } from './TestConnectionPanel';
import type { DataSource, ConnectionTestResult, DbDriver } from '@/core/types/workspace';

type Props = {
  source: DataSource | null;
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onUpdated: (source: DataSource) => void;
};

const DB_BADGE: Record<DbDriver, string> = {
  postgres: 'PG',
  duckdb: 'DDB',
  mssql: 'SQL',
  mysql: 'MY',
};

type FormState = {
  name: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  connectionString: string;
};

export function EditSourceDrawer({ source, workspaceId, open, onClose, onUpdated }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '', host: '', port: '', user: '', password: '', database: '', ssl: false, connectionString: '',
  });
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        host: '',
        port: '',
        user: '',
        password: '',
        database: '',
        ssl: source.connectionSettingsJson?.ssl_mode === 'require',
        connectionString: '',
      });
      setTestResult(null);
    }
  }, [source]);

  if (!source) return null;

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const credentials = source.connectionMode === 'connection_string'
      ? { connection_string: form.connectionString }
      : { host: form.host, port: Number(form.port) || 5432, user: form.user, password: form.password, database: form.database, ssl: form.ssl };
    const res = await fetch(`/api/data-sources/${workspaceId}/${source.id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials }),
    });
    const data = (await res.json()) as { result: ConnectionTestResult };
    setTestResult(data.result);
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const credentials = source.connectionMode === 'connection_string'
      ? { connection_string: form.connectionString }
      : { host: form.host, port: Number(form.port) || 5432, user: form.user, password: form.password, database: form.database, ssl: form.ssl };
    const body: Record<string, unknown> = { name: form.name };
    if (form.password || form.connectionString || form.host) body['credentials'] = credentials;
    const res = await fetch(`/api/data-sources/${workspaceId}/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { source: DataSource };
    setSaving(false);
    onUpdated(data.source);
    onClose();
  };

  const isConnectionString = source.connectionMode === 'connection_string';
  const isDuckDb = source.dbType === 'duckdb';

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="flex w-[420px] flex-col gap-0 overflow-y-auto sm:max-w-[420px]">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">{DB_BADGE[source.dbType]}</Badge>
            <SheetTitle className="text-base">{source.name}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Source name</label>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Connection details
            </p>
            {isConnectionString ? (
              <ConnectionStringInput
                value={form.connectionString}
                onChange={(v) => patch({ connectionString: v })}
                dbType={source.dbType}
              />
            ) : isDuckDb ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">File path</label>
                <Input
                  value={form.database}
                  onChange={(e) => patch({ database: e.target.value })}
                  placeholder="./data/warehouse.duckdb"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Host</label>
                    <Input value={form.host} onChange={(e) => patch({ host: e.target.value })} placeholder="localhost" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Port</label>
                    <Input value={form.port} onChange={(e) => patch({ port: e.target.value })} placeholder="5432" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Database</label>
                  <Input value={form.database} onChange={(e) => patch({ database: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Username</label>
                    <Input value={form.user} onChange={(e) => patch({ user: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Password</label>
                    <SecretField value={form.password} onChange={(v) => patch({ password: v })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Test connection'}
            </Button>
            <TestConnectionPanel result={testResult} loading={testing} />
          </div>
        </div>

        <SheetFooter className="mt-4 flex gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
