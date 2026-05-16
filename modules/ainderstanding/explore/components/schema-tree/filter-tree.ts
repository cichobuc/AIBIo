import type { TreeNode } from './types';

type FilterResult = {
  filtered: TreeNode[];
  matchedAncestors: Set<string>;
};

function nodeLabel(node: TreeNode): string {
  switch (node.kind) {
    case 'connection': return node.name;
    case 'schema': return node.schemaName;
    case 'group': return node.groupType;
    case 'table': return node.tableName;
    case 'view': return node.viewName;
    case 'column': return node.columnName;
    case 'routine': return node.routineName;
    case 'index': return node.indexName;
  }
}

function hasChildren(node: TreeNode): node is TreeNode & { children: TreeNode[] } {
  return 'children' in node;
}

function filterNode(
  node: TreeNode,
  query: string,
  matchedAncestors: Set<string>,
): TreeNode | null {
  const labelMatches = nodeLabel(node).toLowerCase().includes(query);

  if (!hasChildren(node)) {
    return labelMatches ? node : null;
  }

  const filteredChildren: TreeNode[] = [];
  for (const child of node.children) {
    const result = filterNode(child, query, matchedAncestors);
    if (result) filteredChildren.push(result);
  }

  if (labelMatches || filteredChildren.length > 0) {
    if (filteredChildren.length > 0) {
      matchedAncestors.add(node.id);
    }
    return { ...node, children: filteredChildren } as TreeNode;
  }

  return null;
}

export function filterTree(nodes: TreeNode[], query: string): FilterResult {
  const q = query.toLowerCase().trim();
  if (!q) return { filtered: nodes, matchedAncestors: new Set() };

  const matchedAncestors = new Set<string>();
  const filtered: TreeNode[] = [];

  for (const node of nodes) {
    const result = filterNode(node, q, matchedAncestors);
    if (result) filtered.push(result);
  }

  return { filtered, matchedAncestors };
}
