'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/core/ui/dialog';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { SecretField } from './SecretField';
import { ConnectionStringInput } from './ConnectionStringInput';
import { TestConnectionPanel } from './TestConnectionPanel';
import type {
  DbDriver,
  ConnectionMode,
  DataSource,
  ConnectionTestResult,
} from '@/core/types/workspace';

type Props = {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (source: DataSource) => void;
};

type DbOption = { type: DbDriver; label: string; badge: string; desc: string };

const DB_OPTIONS: DbOption[] = [
  { type: 'postgres', label: 'PostgreSQL', badge: 'PG', desc: 'Most common, great performance' },
  { type: 'duckdb', label: 'DuckDB', badge: 'DDB', desc: 'Local analytical DB, perfect for files' },
  { type: 'mssql', label: 'SQL Server', badge: 'SQL', desc: 'Microsoft ecosystem' },
  { type: 'mysql', label: 'MySQL', badge: 'MY', desc: 'Popular for web apps' },
];

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

const DEFAULT_PORTS: Record<DbDriver, string> = {
  postgres: '5432',
  duckdb: '',
  mssql: '1433',
  mysql: '3306',
};

function StepDbType({
  selected,
  mode,
  onSelect,
  onModeChange,
  onNext,
}: {
  selected: DbDriver | null;
  mode: ConnectionMode;
  onSelect: (t: DbDriver) => void;
  onModeChange: (m: ConnectionMode) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {DB_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => onSelect(opt.type)}
            className={`relative rounded-lg border-2 p-4 text-left transition-all ${
              selected === opt.type
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            {selected === opt.type && (
              <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" />
            )}
            <span className="text-lg font-bold text-muted-foreground">{opt.badge}</span>
            <p className="mt-1 font-medium text-foreground">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {(['form', 'connection_string'] as ConnectionMode[]).map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="conn-mode"
              checked={mode === m}
              onChange={() => onModeChange(m)}
              className="accent-primary"
            />
            {m === 'form' ? 'Form-based' : 'Connection string'}
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!selected}>
          Next: Configure
        </Button>
      </div>
    </div>
  );
}

function StepConfigure({
  dbType,
  mode,
  form,
  onChange,
  onBack,
  onNext,
}: {
  dbType: DbDriver;
  mode: ConnectionMode;
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const nameValid = form.name.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Source name</label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder='e.g. "warehouse", "production_db"'
        />
      </div>

      {mode === 'connection_string' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Connection string</label>
          <ConnectionStringInput
            value={form.connectionString}
            onChange={(v) => onChange({ connectionString: v })}
            dbType={dbType}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {dbType !== 'duckdb' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Host</label>
                  <Input
                    value={form.host}
                    onChange={(e) => onChange({ host: e.target.value })}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Port</label>
                  <Input
                    value={form.port}
                    onChange={(e) => onChange({ port: e.target.value })}
                    placeholder={DEFAULT_PORTS[dbType]}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Database</label>
                <Input
                  value={form.database}
                  onChange={(e) => onChange({ database: e.target.value })}
                  placeholder="my_database"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <Input
                    value={form.user}
                    onChange={(e) => onChange({ user: e.target.value })}
                    placeholder="admin"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <SecretField
                    value={form.password}
                    onChange={(v) => onChange({ password: v })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.ssl}
                  onChange={(e) => onChange({ ssl: e.target.checked })}
                  className="accent-primary"
                />
                Enable SSL
              </label>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">File path</label>
              <Input
                value={form.database}
                onChange={(e) => onChange({ database: e.target.value })}
                placeholder="./data/warehouse.duckdb"
              />
              <p className="text-xs text-muted-foreground">
                Relative path is resolved from the AIBIo data directory.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!nameValid}>
          Next: Verify
        </Button>
      </div>
    </div>
  );
}

function buildCredentials(dbType: DbDriver, mode: ConnectionMode, form: FormState) {
  if (mode === 'connection_string') {
    return { connection_string: form.connectionString };
  }
  if (dbType === 'duckdb') {
    return { host: '', port: 0, user: '', password: '', database: form.database, ssl: false };
  }
  return {
    host: form.host,
    port: Number(form.port) || 5432,
    user: form.user,
    password: form.password,
    database: form.database,
    ssl: form.ssl,
  };
}

function StepVerify({
  workspaceId,
  dbType,
  mode,
  form,
  onBack,
  onCreated,
  onClose,
}: {
  workspaceId: string;
  dbType: DbDriver;
  mode: ConnectionMode;
  form: FormState;
  onBack: () => void;
  onCreated: (source: DataSource) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    const credentials = buildCredentials(dbType, mode, form);
    const res = await fetch('/api/data-sources/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbType, connectionMode: mode, credentials }),
    });
    const data = (await res.json()) as { result: ConnectionTestResult };
    setResult(data.result);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const credentials = buildCredentials(dbType, mode, form);
    const res = await fetch(`/api/data-sources/${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, dbType, connectionMode: mode, credentials }),
    });
    const data = (await res.json()) as { source: DataSource };
    setSaving(false);
    onCreated(data.source);
    onClose();
  };

  return (
    <div className="space-y-4">
      <TestConnectionPanel result={result} loading={loading} />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleTest} disabled={loading}>
          Test Connection
        </Button>
        {result?.success && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Finish'}
          </Button>
        )}
        {result && !result.success && (
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save anyway (with warning)'}
          </Button>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

const STEPS = ['Choose type', 'Configure', 'Verify'] as const;

export function AddSourceWizard({ workspaceId, open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [dbType, setDbType] = useState<DbDriver | null>(null);
  const [mode, setMode] = useState<ConnectionMode>('form');
  const [form, setForm] = useState<FormState>({
    name: '',
    host: 'localhost',
    port: '5432',
    user: '',
    password: '',
    database: '',
    ssl: false,
    connectionString: '',
  });

  const handleSelectType = (t: DbDriver) => {
    setDbType(t);
    setForm((prev) => ({ ...prev, port: DEFAULT_PORTS[t] }));
  };

  const handleClose = () => {
    setStep(0);
    setDbType(null);
    setMode('form');
    setForm({ name: '', host: 'localhost', port: '5432', user: '', password: '', database: '', ssl: false, connectionString: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Data Source</DialogTitle>
        </DialogHeader>

        <div className="flex gap-0 mb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`ml-1.5 text-xs ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 h-px w-8 ${i < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <StepDbType
            selected={dbType}
            mode={mode}
            onSelect={handleSelectType}
            onModeChange={setMode}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && dbType && (
          <StepConfigure
            dbType={dbType}
            mode={mode}
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && dbType && (
          <StepVerify
            workspaceId={workspaceId}
            dbType={dbType}
            mode={mode}
            form={form}
            onBack={() => setStep(1)}
            onCreated={onCreated}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
