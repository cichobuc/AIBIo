'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui';
import type { Model } from '@/modules/ainderstanding/model/db/schema';
import { SqlEditor } from '@/modules/ainderstanding/model/components/SqlEditor';
import { LineageDAG } from '@/modules/ainderstanding/model/components/LineageDAG';
import { MaterializedDataPreview } from '@/modules/ainderstanding/model/components/MaterializedDataPreview';
import { ModelRunHistory } from '@/modules/ainderstanding/model/components/ModelRunHistory';
import { Layers, GitBranch, Eye, History } from 'lucide-react';

interface ModelGroup {
  staging: Model[];
  intermediate: Model[];
  marts: Model[];
}

interface Props {
  workspaceId: string;
  initialModels: ModelGroup;
}

export function ModelPageClient({ workspaceId, initialModels }: Props) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [modelSql, setModelSql] = useState<string>('');
  const [loadingSql, setLoadingSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'lineage' | 'preview' | 'history'>('editor');
  const [building, setBuilding] = useState(false);

  const allModels = [
    ...initialModels.staging,
    ...initialModels.intermediate,
    ...initialModels.marts,
  ];

  const handleSelectModel = useCallback(async (model: Model) => {
    setSelectedModel(model);
    setLoadingSql(true);
    setActiveTab('editor');
    try {
      const res = await fetch(`/api/model/${workspaceId}/${model.id}`);
      if (res.ok) {
        const data = (await res.json()) as { sql: string };
        setModelSql(data.sql);
      }
    } finally {
      setLoadingSql(false);
    }
  }, [workspaceId]);

  const handleBuildAll = useCallback(async () => {
    setBuilding(true);
    setActiveTab('history');
    try {
      await fetch(`/api/model/${workspaceId}/build`, { method: 'POST' });
    } finally {
      setTimeout(() => setBuilding(false), 2000);
    }
  }, [workspaceId]);

  const handleBuildSingle = useCallback(async () => {
    if (!selectedModel) return;
    setBuilding(true);
    setActiveTab('history');
    try {
      await fetch(`/api/model/${workspaceId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelNames: [selectedModel.name] }),
      });
    } finally {
      setTimeout(() => setBuilding(false), 2000);
    }
  }, [workspaceId, selectedModel]);

  // Empty state when no models exist
  if (allModels.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6 text-center">
        <Layers className="w-12 h-12 text-muted-foreground opacity-30" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold">No models yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Build your dimensional model: staging → intermediate → marts. AI can propose the entire structure.
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="text-sm px-3 py-1.5 rounded border border-primary text-primary hover:bg-primary/10 transition-colors"
            onClick={() => {
              /* TODO: trigger AI proposal via chat */
            }}
          >
            Ask AI to propose model →
          </button>
          <p className="text-xs text-muted-foreground self-center">or use the sidebar to create manually</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          ℹ Requires profiled data. Go to{' '}
          <a href={`/workspace/${workspaceId}/explore`} className="underline hover:text-foreground">
            Explore
          </a>{' '}
          first.
        </p>
      </div>
    );
  }

  // When no model is selected yet
  if (!selectedModel) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-center px-6">
        <p className="text-sm text-muted-foreground">Select a model from the sidebar to edit.</p>
        <p className="text-xs text-muted-foreground">
          Or switch to{' '}
          <button onClick={() => setActiveTab('lineage')} className="underline hover:text-foreground">
            Lineage DAG
          </button>{' '}
          to explore dependencies.
        </p>
        <div className="mt-4 w-full max-w-lg h-64 border rounded-lg overflow-hidden">
          <LineageDAG
            workspaceId={workspaceId}
            onSelectModel={(id) => {
              const m = allModels.find((m) => m.id === id);
              if (m) void handleSelectModel(m);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex flex-col h-full"
      >
        <div className="flex items-center border-b shrink-0">
          <TabsList className="h-8 bg-transparent rounded-none border-0 px-2 gap-0">
            <TabsTrigger
              value="editor"
              className="h-8 text-xs px-3 gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Layers className="w-3 h-3" />
              {selectedModel.name}.sql
            </TabsTrigger>
            <TabsTrigger
              value="lineage"
              className="h-8 text-xs px-3 gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <GitBranch className="w-3 h-3" />
              Lineage
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-8 text-xs px-3 gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Eye className="w-3 h-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="h-8 text-xs px-3 gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <History className="w-3 h-3" />
              Runs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="editor" className="flex-1 min-h-0 mt-0">
          {loadingSql ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : (
            <SqlEditor
              model={selectedModel}
              workspaceId={workspaceId}
              initialSql={modelSql}
              onSaved={() => router.refresh()}
            />
          )}
        </TabsContent>

        <TabsContent value="lineage" className="flex-1 min-h-0 mt-0">
          <LineageDAG
            workspaceId={workspaceId}
            onSelectModel={(id) => {
              const m = allModels.find((m) => m.id === id);
              if (m) void handleSelectModel(m);
            }}
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0 mt-0">
          <MaterializedDataPreview
            workspaceId={workspaceId}
            modelName={selectedModel.name}
          />
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 mt-0">
          <ModelRunHistory
            workspaceId={workspaceId}
            onBuildAll={handleBuildAll}
            building={building}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
