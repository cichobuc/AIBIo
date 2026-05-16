'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Button,
  Input,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  cn,
} from '@/core/ui';
import { AddSourceWizard } from '@/modules/ainderstanding/connect/components/AddSourceWizard';
import { EditSourceDrawer } from '@/modules/ainderstanding/connect/components/EditSourceDrawer';
import { RemoveSourceDialog } from '@/modules/ainderstanding/connect/components/RemoveSourceDialog';
import type { DataSource, SchemaSnapshot } from '@/core/types/workspace';
import type { ExploreSource, ExploreTableProfile, ExploreColumnProfile } from '../lib/explore-data';

type SnapshotRow = { dataSourceId: string; snapshotJson: string };
import { buildSchemaTree } from './schema-tree/build-tree';
import { filterTree } from './schema-tree/filter-tree';
import { SchemaTree } from './schema-tree/SchemaTree';
import type { TreeNode, ContextAction } from './schema-tree/types';

type Props = {
  workspaceId: string;
  sources: ExploreSource[];
  snapshots: SnapshotRow[];
  tables: ExploreTableProfile[];
  columns: ExploreColumnProfile[];
};

function loadExpanded(workspaceId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`aibio-explore-tree:${workspaceId}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveExpanded(workspaceId: string, expanded: Set<string>): void {
  try {
    localStorage.setItem(`aibio-explore-tree:${workspaceId}`, JSON.stringify([...expanded]));
  } catch {}
}

export function ExploreSidebar({ workspaceId, sources, snapshots, tables, columns }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(workspaceId));
  const [addOpen, setAddOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [removingSource, setRemovingSource] = useState<DataSource | null>(null);

  // Persist expanded set to localStorage on change
  useEffect(() => {
    saveExpanded(workspaceId, expanded);
  }, [workspaceId, expanded]);

  const selectedSourceId = sp.get('source') ?? null;
  const selectedTable = sp.get('table') ?? null;
  const selectedId = selectedSourceId && selectedTable
    ? `src/${selectedSourceId}/schema/main/table/${selectedTable}`
    : null;

  // Build snapshot map
  const snapshotMap = new Map<string, SchemaSnapshot>();
  for (const s of snapshots) {
    try {
      snapshotMap.set(s.dataSourceId, JSON.parse(s.snapshotJson) as SchemaSnapshot);
    } catch {}
  }

  // Build profile maps
  const profileMap = new Map<string, ExploreTableProfile>();
  for (const t of tables) {
    profileMap.set(`${t.dataSourceId}:${t.tableName}`, t);
  }

  const colProfileMap = new Map<string, ExploreColumnProfile[]>();
  for (const c of columns) {
    const key = `${c.dataSourceId}:${c.tableName}`;
    const arr = colProfileMap.get(key) ?? [];
    arr.push(c);
    colProfileMap.set(key, arr);
  }

  const tree = buildSchemaTree({
    sources,
    snapshots: snapshotMap,
    profiles: profileMap,
    columnProfiles: colProfileMap,
  });

  const { filtered, matchedAncestors } = filterTree(tree, search);

  const effectiveExpanded = search ? new Set([...expanded, ...matchedAncestors]) : expanded;

  const handleToggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const handleSelect = useCallback(
    (node: TreeNode) => {
      if (node.kind === 'table') {
        router.push(
          `?source=${encodeURIComponent(node.sourceId)}&table=${encodeURIComponent(node.tableName)}`,
          { scroll: false },
        );
      } else if (node.kind === 'view') {
        router.push(
          `?source=${encodeURIComponent(node.sourceId)}&table=${encodeURIComponent(node.viewName)}`,
          { scroll: false },
        );
      }
    },
    [router],
  );

  const handleContextAction = useCallback(
    async (action: ContextAction, node: TreeNode) => {
      const sourceId = node.sourceId;

      switch (action) {
        case 'add-connection':
          setAddOpen(true);
          break;

        case 'edit': {
          const src = sources.find((s) => s.id === sourceId);
          if (src) {
            setEditingSource({
              id: src.id,
              workspaceId,
              name: src.name,
              dbType: src.dbType as DataSource['dbType'],
              connectionMode: 'form',
              connectionSettingsJson: null,
              status: src.status as DataSource['status'],
              lastTestedAt: null,
              createdAt: '',
              updatedAt: '',
            });
          }
          break;
        }

        case 'remove': {
          const src = sources.find((s) => s.id === sourceId);
          if (src) {
            setRemovingSource({
              id: src.id,
              workspaceId,
              name: src.name,
              dbType: src.dbType as DataSource['dbType'],
              connectionMode: 'form',
              connectionSettingsJson: null,
              status: src.status as DataSource['status'],
              lastTestedAt: null,
              createdAt: '',
              updatedAt: '',
            });
          }
          break;
        }

        case 'test':
          try {
            await fetch(`/api/data-sources/${workspaceId}/${sourceId}/test`, { method: 'POST' });
            router.refresh();
          } catch {}
          break;

        case 'refresh-schema': {
          const sid = node.kind === 'connection' ? sourceId
            : node.kind === 'schema' || node.kind === 'group' ? sourceId
            : sourceId;
          try {
            await fetch(`/api/data-sources/${workspaceId}/${sid}/refresh-schema`, { method: 'POST' });
            router.refresh();
          } catch {}
          break;
        }

        case 'copy-name': {
          let name = '';
          if (node.kind === 'connection') name = node.name;
          else if (node.kind === 'schema') name = node.schemaName;
          else if (node.kind === 'table') name = node.tableName;
          else if (node.kind === 'view') name = node.viewName;
          else if (node.kind === 'column') name = node.columnName;
          else if (node.kind === 'routine') name = node.routineName;
          else if (node.kind === 'index') name = node.indexName;
          if (name) navigator.clipboard.writeText(name).catch(() => {});
          break;
        }

        case 'open-in-explore': {
          const tableName = node.kind === 'table' ? node.tableName : node.kind === 'view' ? node.viewName : null;
          if (tableName) {
            router.push(
              `?source=${encodeURIComponent(sourceId)}&table=${encodeURIComponent(tableName)}`,
              { scroll: false },
            );
          }
          break;
        }

        case 'mark-pii':
          // deferred — requires govern column-permissions endpoint
          break;
      }
    },
    [sources, workspaceId, router],
  );

  const handleRemoveConfirm = async () => {
    if (!removingSource) return;
    await fetch(`/api/data-sources/${workspaceId}/${removingSource.id}`, { method: 'DELETE' });
    setRemovingSource(null);
    router.refresh();
  };

  const workspaceName = sources.length > 0 ? 'Explore' : 'Explore';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {workspaceName}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setAddOpen(true)}
          title="Add connection"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <Input
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* Tree with empty-area right-click */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className={cn('min-h-full px-1 pb-4', filtered.length === 0 && 'flex items-start')}>
              <SchemaTree
                nodes={filtered}
                expanded={effectiveExpanded}
                selectedId={selectedId}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onContextAction={handleContextAction}
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Connection
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Dialogs */}
      <AddSourceWizard
        workspaceId={workspaceId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {editingSource && (
        <EditSourceDrawer
          source={editingSource}
          workspaceId={workspaceId}
          open={!!editingSource}
          onClose={() => setEditingSource(null)}
          onUpdated={() => {
            setEditingSource(null);
            router.refresh();
          }}
        />
      )}

      {removingSource && (
        <RemoveSourceDialog
          source={removingSource}
          open={!!removingSource}
          onClose={() => setRemovingSource(null)}
          onConfirm={handleRemoveConfirm}
        />
      )}
    </div>
  );
}
