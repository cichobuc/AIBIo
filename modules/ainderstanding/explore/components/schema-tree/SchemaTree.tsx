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
  Lock,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@/core/ui';
import { TIER_LABELS, TIER_DESCRIPTIONS, TIER_ICONS } from '@/modules/ainderstanding/govern/lib/tier-labels';
import type { TreeNode, ContextAction, GroupType, AccessTier } from './types';

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


function TierIcon({ tier, className, withTooltip }: { tier: AccessTier; className?: string; withTooltip?: boolean }) {
  const spec = TIER_ICONS[tier];
  const Icon = spec.icon;
  const icon = <Icon className={cn('h-3 w-3 shrink-0', spec.className, className)} />;

  if (!withTooltip) return icon;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{icon}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-48">
          <p className="font-medium">{TIER_LABELS[tier]}</p>
          <p className="text-muted-foreground">{TIER_DESCRIPTIONS[tier]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TierSubmenu({ currentTier, node, onContextAction }: {
  currentTier: AccessTier;
  node: TreeNode;
  onContextAction: (action: ContextAction, node: TreeNode) => void;
}) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="text-xs">
        <TierIcon tier={currentTier} className="mr-1.5" />
        Set access tier…
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuRadioGroup value={currentTier}>
          {([
            { tier: 'metadata_only' as const, action: 'set-tier-metadata' as const, label: 'Metadata only' },
            { tier: 'with_reference_samples' as const, action: 'set-tier-reference' as const, label: 'Reference tables only' },
            { tier: 'with_full_samples' as const, action: 'set-tier-full' as const, label: 'Full samples' },
            { tier: 'with_query_results' as const, action: 'set-tier-query' as const, label: 'Full + query results' },
          ]).map(({ tier, action, label }) => {
            const { icon: Icon, className: iconCls } = TIER_ICONS[tier];
            return (
              <ContextMenuRadioItem key={tier} className="text-xs" value={tier} onSelect={() => onContextAction(action, node)}>
                <Icon className={cn('h-3 w-3 mr-1.5', iconCls)} />
                {label}
              </ContextMenuRadioItem>
            );
          })}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

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
            <span
              className="flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground"
              onClick={handleChevronClick}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              ) : null}
            </span>

            <NodeIcon node={node} />
            <NodeLabel node={node} onContextAction={onContextAction} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.kind === 'connection' && (
            <>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('edit', node)}>Edit</ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('test', node)}>Test connection</ContextMenuItem>
              <ContextMenuSeparator />
              <TierSubmenu currentTier={node.effectiveTier} node={node} onContextAction={onContextAction} />
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('add-table-override', node)}>
                Add table override…
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('refresh-schema', node)}>Refresh schema</ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onSelect={() => onContextAction('remove', node)}
              >
                Remove
              </ContextMenuItem>
            </>
          )}
          {node.kind === 'schema' && (
            <>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('refresh-schema', node)}>Refresh schema</ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'group' && (
            <ContextMenuItem className="text-xs" onSelect={() => onContextAction('refresh-schema', node)}>Refresh</ContextMenuItem>
          )}
          {node.kind === 'table' && (
            <>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('open-in-explore', node)}>Open in Explore</ContextMenuItem>
              <ContextMenuSeparator />
              <TierSubmenu currentTier={node.effectiveTier} node={node} onContextAction={onContextAction} />
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('clear-table-override', node)}>
                Clear table override
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('refresh-schema', node)}>Refresh profile</ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'view' && (
            <>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('open-in-explore', node)}>Open in Explore</ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {node.kind === 'column' && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger className="text-xs">
                  {node.piiClassification !== 'none' ? (
                    <Lock className="h-3 w-3 mr-1.5 text-destructive" />
                  ) : (
                    <Lock className="h-3 w-3 mr-1.5 text-muted-foreground/40" />
                  )}
                  PII classification…
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuRadioGroup value={node.piiClassification}>
                    <ContextMenuRadioItem
                      className="text-xs"
                      value="none"
                      onSelect={() => onContextAction('set-pii-none', node)}
                    >
                      None
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem
                      className="text-xs"
                      value="pii"
                      onSelect={() => onContextAction('set-pii-pii', node)}
                    >
                      PII
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem
                      className="text-xs"
                      value="sensitive"
                      onSelect={() => onContextAction('set-pii-sensitive', node)}
                    >
                      Sensitive
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
            </>
          )}
          {(node.kind === 'routine' || node.kind === 'index') && (
            <ContextMenuItem className="text-xs" onSelect={() => onContextAction('copy-name', node)}>Copy name</ContextMenuItem>
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
        <span className="relative flex items-center gap-0.5">
          <Database className={cn(cls, 'text-accent-ai')} />
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full',
              STATUS_DOT[node.status] ?? 'bg-muted-foreground',
            )}
          />
          <TierIcon tier={node.effectiveTier} withTooltip />
        </span>
      );
    case 'schema': return <FolderTree className={cls} />;
    case 'group': {
      const Icon = GROUP_ICONS[node.groupType];
      return <Icon className={cls} />;
    }
    case 'table':
      return (
        <span className="flex items-center gap-0.5">
          <Table2 className={cls} />
          <TierIcon tier={node.effectiveTier} withTooltip />
        </span>
      );
    case 'view': return <Eye className={cls} />;
    case 'column':
      return (
        <span className="flex items-center gap-0.5">
          <Columns3 className={cls} />
          {node.isPrimaryKey && <KeyRound className="h-2.5 w-2.5 text-yellow-500" />}
          {node.isForeignKey && !node.isPrimaryKey && <KeyRound className="h-2.5 w-2.5 text-blue-400" />}
          {node.piiClassification !== 'none' && <Lock className="h-2.5 w-2.5 text-destructive" />}
        </span>
      );
    case 'routine': return <FunctionSquare className={cls} />;
    case 'index': return <KeyRound className={cls} />;
  }
}

function NodeLabel({ node, onContextAction }: { node: TreeNode; onContextAction?: (action: ContextAction, node: TreeNode) => void }) {
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
          {node.piiClassification !== 'none' && (
            <button
              className="shrink-0 cursor-pointer rounded text-[10px] text-destructive uppercase hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onContextAction?.('open-pii-inventory', node);
              }}
            >
              {node.piiClassification}
            </button>
          )}
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
