'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@/core/ui';
import type { Model, ModelLayer } from '../db/schema';
import { NewModelDialog } from './NewModelDialog';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Layers } from 'lucide-react';

interface ModelGroup {
  staging: Model[];
  intermediate: Model[];
  marts: Model[];
}

interface Props {
  workspaceId: string;
  initialModels: ModelGroup;
  selectedModelId?: string;
  onSelectModel?: (model: Model) => void;
}

const LAYER_LABELS: Record<ModelLayer, string> = {
  staging: 'Staging',
  intermediate: 'Intermediate',
  marts: 'Marts',
};

const LAYER_ORDER: ModelLayer[] = ['staging', 'intermediate', 'marts'];

const STATUS_COLORS = {
  success: 'bg-green-500',
  failed: 'bg-red-500',
  approval_denied: 'bg-yellow-500',
} as const;

export function ModelExplorer({ workspaceId, initialModels, selectedModelId, onSelectModel }: Props) {
  const router = useRouter();
  const [models, setModels] = useState<ModelGroup>(initialModels);
  const [collapsed, setCollapsed] = useState<Record<ModelLayer, boolean>>({
    staging: false,
    intermediate: false,
    marts: false,
  });
  const [newModelOpen, setNewModelOpen] = useState(false);

  const totalCount = models.staging.length + models.intermediate.length + models.marts.length;

  const handleToggle = (layer: ModelLayer) => {
    setCollapsed((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleSelect = useCallback(
    (model: Model) => {
      if (onSelectModel) {
        onSelectModel(model);
      } else {
        router.push(`/workspace/${workspaceId}/model?modelId=${model.id}`);
      }
    },
    [workspaceId, onSelectModel, router],
  );

  const handleDelete = async (model: Model) => {
    const ok = confirm(`Delete model "${model.name}"? This cannot be undone.`);
    if (!ok) return;
    await fetch(`/api/model/${workspaceId}/${model.id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleModelCreated = (model: Model) => {
    setModels((prev) => ({
      ...prev,
      [model.layer]: [...prev[model.layer], model],
    }));
    setNewModelOpen(false);
    handleSelect(model);
  };

  if (totalCount === 0) {
    return (
      <div className="flex flex-col h-full">
        <ExplorerHeader onNew={() => setNewModelOpen(true)} />
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 py-8 text-center">
          <Layers className="w-8 h-8 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium">No models yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Build your dimensional model: staging → intermediate → marts.
          </p>
          <Button size="sm" className="mt-1" onClick={() => setNewModelOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create manually
          </Button>
        </div>
        <NewModelDialog
          workspaceId={workspaceId}
          open={newModelOpen}
          onOpenChange={setNewModelOpen}
          onCreated={handleModelCreated}
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden">
        <ExplorerHeader onNew={() => setNewModelOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          {LAYER_ORDER.map((layer) => (
            <LayerGroup
              key={layer}
              layer={layer}
              models={models[layer]}
              collapsed={collapsed[layer]}
              selectedModelId={selectedModelId}
              onToggle={() => handleToggle(layer)}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <NewModelDialog
          workspaceId={workspaceId}
          open={newModelOpen}
          onOpenChange={setNewModelOpen}
          onCreated={handleModelCreated}
        />
      </div>
    </TooltipProvider>
  );
}

function ExplorerHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Models</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNew}>
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function LayerGroup({
  layer,
  models,
  collapsed,
  selectedModelId,
  onToggle,
  onSelect,
  onDelete,
}: {
  layer: ModelLayer;
  models: Model[];
  collapsed: boolean;
  selectedModelId?: string;
  onToggle: () => void;
  onSelect: (m: Model) => void;
  onDelete: (m: Model) => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {LAYER_LABELS[layer]}
        <span className="ml-auto tabular-nums">{models.length}</span>
      </button>
      {!collapsed && (
        <div className="pl-1">
          {models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              selected={model.id === selectedModelId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
  onDelete,
}: {
  model: Model;
  selected: boolean;
  onSelect: (m: Model) => void;
  onDelete: (m: Model) => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 px-3 py-1 cursor-pointer rounded-sm mx-1 text-sm hover:bg-accent/60',
        selected && 'bg-accent text-accent-foreground',
      )}
      onClick={() => onSelect(model)}
    >
      <span className="truncate flex-1 font-mono text-xs">{model.name}</span>
      {model.isDirty && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="h-4 text-[10px] px-1 border-yellow-500 text-yellow-500">
              ~
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Unsaved changes</TooltipContent>
        </Tooltip>
      )}
      {model.lastRunStatus && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            STATUS_COLORS[model.lastRunStatus as keyof typeof STATUS_COLORS] ?? 'bg-muted',
          )}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
          >
            <MoreHorizontal className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-sm">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
