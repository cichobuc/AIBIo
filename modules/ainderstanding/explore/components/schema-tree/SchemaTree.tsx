'use client';

import {
  Database,
  FolderTree,
  Table2,
  Eye,
  FunctionSquare,
  KeyRound,
  Columns3,
  ChevronRight,
  ChevronDown,
  Dot,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  cn,
} from '@/core/ui';
import type { TreeNode, ContextAction, GroupType } from './types';

type TreeCallbacks = {
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  onContextAction: (action: ContextAction, node: TreeNode) => void;
};

type Props = TreeCallbacks & {
  nodes: TreeNode[];
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  error: 'bg-red-500',
  pending: 'bg-muted-foreground',
};

const GROUP_ICONS: Record<GroupType, React.ElementType> = {
  tables: Table2,
  views: Eye,
  routines: FunctionSquare,
  indexes: KeyRound,
};

const GROUP_LABELS: Record<GroupType, string> = {
  tables: 'Tables',
  views: 'Views',
  routines: 'Functions',
  indexes: 'Indexes',
};


function TreeRow({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect,
  onContextAction,
}: TreeCallbacks & { node: TreeNode; depth: number }) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = 'children' in node && (node as { children: TreeNode[] }).children.length > 0;
  const indent = depth * 12 + 6;

  const handleRowClick = () => {
    onSelect(node);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) onToggle(node.id);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              'flex w-full cursor-pointer items-center gap-1 rounded-sm py-[3px] pr-2 text-xs transition-colors hover:bg-accent/50 select-none',
              isSelected && 'bg-accent text-accent-foreground',
            )}
            style={{ paddingLeft: indent }}
            onClick={handleRowClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRowClick(); }}
          >
            {/* Chevron — dedicated toggle zone */}
            <span
              className="flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground"
              onClick={handleChevronClick}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              ) : null}
            </span>

            {/* Icon + label */}
            <NodeIcon node={node} />
            <NodeLabel node={node} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.kind === 'connection' && (
            <>
              <ContextMenuItem onSelect={() => onContextAction('edit', node)}>Edit</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('test', node)}>Test connection</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onContextAction('refresh-schema', node)}>Refresh schema</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onContextAction('remove', node)} className="text-destructive focus:text-destructive">
                Remove
              </ContextMenuItem>
            </>
          )}
          {node.kind === 'schema' && (
            <>
              <ContextMenuItem onSelect={() => onContextAction('refresh-schema', node)}>Refresh schema</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'group' && (
            <ContextMenuItem onSelect={() => onContextAction('refresh-schema', node)}>Refresh</ContextMenuItem>
          )}
          {node.kind === 'table' && (
            <>
              <ContextMenuItem onSelect={() => onContextAction('open-in-explore', node)}>Open in Explore</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onContextAction('refresh-schema', node)}>Refresh profile</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'view' && (
            <>
              <ContextMenuItem onSelect={() => onContextAction('open-in-explore', node)}>Open in Explore</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'column' && (
            <>
              <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
              <ContextMenuItem onSelect={() => onContextAction('mark-pii', node)}>Mark as PII</ContextMenuItem>
            </>
          )}
          {(node.kind === 'routine' || node.kind === 'index') && (
            <ContextMenuItem onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && hasChildren && (
        <>
          {(node as { children: TreeNode[] }).children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextAction={onContextAction}
            />
          ))}
        </>
      )}
    </>
  );
}

function NodeIcon({ node }: { node: TreeNode }) {
  const cls = 'h-3 w-3 shrink-0 text-muted-foreground';

  switch (node.kind) {
    case 'connection':
      return (
        <span className="relative flex items-center">
          <Database className={cn(cls, 'text-accent-ai')} />
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full',
              STATUS_DOT[node.status] ?? 'bg-muted-foreground',
            )}
          />
        </span>
      );
    case 'schema': return <FolderTree className={cls} />;
    case 'group': {
      const Icon = GROUP_ICONS[node.groupType];
      return <Icon className={cls} />;
    }
    case 'table': return <Table2 className={cls} />;
    case 'view': return <Eye className={cls} />;
    case 'column':
      return (
        <span className="flex items-center gap-0.5">
          <Columns3 className={cls} />
          {node.isPrimaryKey && <KeyRound className="h-2.5 w-2.5 text-yellow-500" />}
          {node.isForeignKey && !node.isPrimaryKey && <KeyRound className="h-2.5 w-2.5 text-blue-400" />}
        </span>
      );
    case 'routine': return <FunctionSquare className={cls} />;
    case 'index': return <KeyRound className={cls} />;
  }
}

function NodeLabel({ node }: { node: TreeNode }) {
  switch (node.kind) {
    case 'connection':
      return <span className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">{node.name}</span>;
    case 'schema':
      return <span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{node.schemaName}</span>;
    case 'group':
      return (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
            {GROUP_LABELS[node.groupType]}
          </span>
          <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">{node.count}</span>
        </span>
      );
    case 'table':
      return (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.tableName}</span>
          {node.isReferenceTable && (
            <span className="shrink-0 rounded bg-accent px-1 text-[10px] text-muted-foreground">ref</span>
          )}
          {node.rowCount !== null && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {node.rowCount.toLocaleString()}
            </span>
          )}
        </span>
      );
    case 'view':
      return <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.viewName}</span>;
    case 'column':
      return (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.columnName}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{node.dataType}</span>
          {node.piiCandidate && <Dot className="h-3 w-3 shrink-0 text-orange-400" />}
        </span>
      );
    case 'routine':
      return (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.routineName}</span>
          {node.returnType && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{node.returnType}</span>
          )}
        </span>
      );
    case 'index':
      return (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.indexName}</span>
          {node.isUnique && <span className="shrink-0 text-[10px] text-muted-foreground">unique</span>}
        </span>
      );
  }
}

export function SchemaTree({ nodes, expanded, selectedId, onToggle, onSelect, onContextAction }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        No connections yet.
        <br />
        Right-click or press + to add one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextAction={onContextAction}
        />
      ))}
    </div>
  );
}
