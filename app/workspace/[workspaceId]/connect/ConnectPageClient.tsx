'use client';

import { useState } from 'react';
import { PlusCircle, PlugZap } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { SecurityNoticeBanner } from '@/modules/ainderstanding/connect/components/SecurityNoticeBanner';
import { SourceCard } from '@/modules/ainderstanding/connect/components/SourceCard';
import { AddSourceWizard } from '@/modules/ainderstanding/connect/components/AddSourceWizard';
import { EditSourceDrawer } from '@/modules/ainderstanding/connect/components/EditSourceDrawer';
import { RemoveSourceDialog } from '@/modules/ainderstanding/connect/components/RemoveSourceDialog';
import { TestConnectionPanel } from '@/modules/ainderstanding/connect/components/TestConnectionPanel';
import type { DataSource, Workspace, ConnectionTestResult } from '@/core/types/workspace';

type Props = {
  workspace: Workspace;
  initialSources: DataSource[];
};

type TestState = {
  sourceId: string;
  result: ConnectionTestResult | null;
  loading: boolean;
};

export function ConnectPageClient({ workspace, initialSources }: Props) {
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [removeSource, setRemoveSource] = useState<DataSource | null>(null);
  const [testState, setTestState] = useState<TestState | null>(null);

  const handleCreated = (source: DataSource) => {
    setSources((prev) => [source, ...prev]);
  };

  const handleUpdated = (source: DataSource) => {
    setSources((prev) => prev.map((s) => (s.id === source.id ? source : s)));
  };

  const handleTest = async (source: DataSource) => {
    setTestState({ sourceId: source.id, result: null, loading: true });
    const res = await fetch(`/api/data-sources/${workspace.id}/${source.id}/test`, {
      method: 'POST',
    });
    const data = (await res.json()) as { result: ConnectionTestResult };
    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id
          ? { ...s, status: data.result.success ? 'active' : 'error', lastTestedAt: new Date().toISOString() }
          : s,
      ),
    );
    setTestState({ sourceId: source.id, result: data.result, loading: false });
  };

  const handleRemove = async () => {
    if (!removeSource) return;
    await fetch(`/api/data-sources/${workspace.id}/${removeSource.id}`, { method: 'DELETE' });
    setSources((prev) => prev.filter((s) => s.id !== removeSource.id));
    setRemoveSource(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Sources in &quot;{workspace.name}&quot;
          </h1>
          <p className="text-sm text-muted-foreground">Manage your data connections</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          Add source
        </Button>
      </div>

      <SecurityNoticeBanner />

      {testState && (
        <TestConnectionPanel result={testState.result} loading={testState.loading} />
      )}

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <PlugZap className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-base font-medium text-foreground">No data sources yet</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Connect your database to start exploring and building your datamart.
            Supports PostgreSQL, MySQL, SQL Server, DuckDB.
          </p>
          <Button className="mt-6" onClick={() => setWizardOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add first data source
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onTest={() => handleTest(source)}
              onEdit={() => setEditSource(source)}
              onRemove={() => setRemoveSource(source)}
            />
          ))}
        </div>
      )}

      <AddSourceWizard
        workspaceId={workspace.id}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />

      <EditSourceDrawer
        source={editSource}
        workspaceId={workspace.id}
        open={editSource !== null}
        onClose={() => setEditSource(null)}
        onUpdated={handleUpdated}
      />

      {removeSource && (
        <RemoveSourceDialog
          source={removeSource}
          open={removeSource !== null}
          onClose={() => setRemoveSource(null)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}
