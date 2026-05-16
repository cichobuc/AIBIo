'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Model } from '../db/schema';

// React Flow is loaded lazily via useEffect (avoids SSR issues with large bundle)

interface LineageNode {
  id: string;
  modelName: string;
  layer: string;
}

interface LineageEdgeData {
  fromModelId: string | null;
  toModelId: string;
  fromSourceRef: string | null;
  refType: string;
}

interface LineageResponse {
  nodes: LineageNode[];
  edges: LineageEdgeData[];
}

interface Props {
  workspaceId: string;
  onSelectModel?: (modelId: string) => void;
  runningModels?: string[];
  failedModels?: string[];
}

const NODE_COLORS: Record<string, string> = {
  source: '#3b82f6',     // blue
  staging: '#6b7280',    // gray
  intermediate: '#f59e0b', // yellow
  marts: '#22c55e',      // green
  error: '#ef4444',      // red
};

export function LineageDAG({ workspaceId, onSelectModel, runningModels = [], failedModels = [] }: Props) {
  const [lineage, setLineage] = useState<LineageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLineage = useCallback(async () => {
    try {
      const res = await fetch(`/api/model/${workspaceId}/lineage`);
      if (res.ok) {
        const data = (await res.json()) as LineageResponse;
        setLineage(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchLineage();
  }, [fetchLineage]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading lineage…
      </div>
    );
  }

  if (!lineage || (lineage.nodes.length === 0 && lineage.edges.length === 0)) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-center px-6">
        <p className="text-sm font-medium">No lineage yet</p>
        <p className="text-xs text-muted-foreground">
          Add <code>ref(&#39;model&#39;)</code> or <code>source(&#39;src&#39;, &#39;table&#39;)</code>{' '}
          references to your SQL files and save to build the lineage graph.
        </p>
      </div>
    );
  }

  return <LineageDAGInner lineage={lineage} onSelectModel={onSelectModel} runningModels={runningModels} failedModels={failedModels} />;
}

function LineageDAGInner({
  lineage,
  onSelectModel,
  runningModels,
  failedModels,
}: {
  lineage: LineageResponse;
  onSelectModel?: (id: string) => void;
  runningModels: string[];
  failedModels: string[];
}) {
  // Build source nodes from source_ref edges
  const sourceRefs = new Set<string>();
  for (const e of lineage.edges) {
    if (e.refType === 'source_ref' && e.fromSourceRef) {
      sourceRefs.add(e.fromSourceRef);
    }
  }

  const rfNodes = [
    // Source nodes
    ...Array.from(sourceRefs).map((ref, i) => ({
      id: `src:${ref}`,
      type: 'default',
      position: { x: 0, y: i * 80 },
      data: { label: ref },
      style: {
        background: NODE_COLORS.source,
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: 11,
        padding: '4px 8px',
      },
    })),
    // Model nodes
    ...lineage.nodes.map((n, i) => {
      const isFailed = failedModels.includes(n.id);
      const isRunning = runningModels.includes(n.id);
      const color = isFailed ? NODE_COLORS.error : (NODE_COLORS[n.layer] ?? '#6b7280');
      return {
        id: n.id,
        type: 'default',
        position: { x: 200 + (i % 3) * 220, y: Math.floor(i / 3) * 100 },
        data: { label: n.modelName },
        style: {
          background: color,
          color: '#fff',
          border: isRunning ? '2px solid #fff' : 'none',
          borderRadius: 6,
          fontSize: 11,
          padding: '4px 8px',
          animation: isRunning ? 'pulse 1s infinite' : undefined,
        },
      };
    }),
  ];

  const rfEdges = lineage.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.fromModelId ?? (e.fromSourceRef ? `src:${e.fromSourceRef}` : ''),
    target: e.toModelId,
    animated: false,
    style: { stroke: e.refType === 'source_ref' ? '#6b7280' : '#9ca3af', strokeDasharray: e.refType === 'source_ref' ? '4,4' : undefined },
    markerEnd: { type: 'arrowclosed' as const },
  })).filter((e) => e.source);

  return (
    <div className="h-full w-full relative">
      <ReactFlowDAG
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={onSelectModel}
      />
    </div>
  );
}

// Lazy-loaded React Flow wrapper to avoid SSR issues
function ReactFlowDAG({
  nodes,
  edges,
  onNodeClick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[];
  onNodeClick?: (id: string) => void;
}) {
  const [FlowComponent, setFlowComponent] = useState<React.ComponentType<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    edges: any[];
    fitView: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNodeClick?: (event: any, node: any) => void;
    children?: React.ReactNode;
  }> | null>(null);
  const [Background, setBackground] = useState<React.ComponentType | null>(null);
  const [Controls, setControls] = useState<React.ComponentType | null>(null);
  const [MiniMap, setMiniMap] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    void import('@xyflow/react').then((m) => {
      setFlowComponent(() => m.ReactFlow);
      setBackground(() => m.Background);
      setControls(() => m.Controls);
      setMiniMap(() => m.MiniMap);
    });
  }, []);

  if (!FlowComponent) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading graph…
      </div>
    );
  }

  return (
    <FlowComponent
      nodes={nodes}
      edges={edges}
      fitView
      onNodeClick={(_event, node) => onNodeClick?.(node.id as string)}
    >
      {Background && <Background />}
      {Controls && <Controls />}
      {MiniMap && <MiniMap />}
    </FlowComponent>
  );
}
