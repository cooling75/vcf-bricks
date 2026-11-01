import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { ArchitectureDocument, ArchitectureNode, CatalogItem, RelationKind } from '../contracts';
import { CATALOG_DRAG_TYPE, type ComponentKind } from '../contracts';
import { CATALOG, getCatalogItem } from '../domain/catalog';
import { effectiveNodeSize } from '../domain/geometry';

/** Drag payloads are untrusted and can be unavailable during dragover. */
export function readCatalogKind(transfer: Pick<DataTransfer, 'types' | 'getData'>): ComponentKind | undefined {
  try {
    if (!Array.from(transfer.types).includes(CATALOG_DRAG_TYPE)) return undefined;
    const value = transfer.getData(CATALOG_DRAG_TYPE);
    return CATALOG.find(item => item.kind === value)?.kind;
  } catch { return undefined; }
}

export interface BrickData extends Record<string, unknown> {
  architecture: ArchitectureNode;
  catalog: CatalogItem;
}
export type BrickFlowNode = Node<BrickData, 'componentBrick' | 'boundaryNode'>;
export interface FlowGraph { nodes: BrickFlowNode[]; edges: Edge[] }

/** Relative positions remain relative: React Flow resolves parentId coordinates. */
export function toFlowGraph(document: ArchitectureDocument, selectedId: string | null): FlowGraph {
  // First occurrence wins. Never give React Flow duplicate IDs or cyclic parents.
  const byId = new Map<string, ArchitectureNode>();
  for (const node of document.nodes) {
    if (node.id && !byId.has(node.id)) byId.set(node.id, node);
  }
  const ordered: ArchitectureNode[] = [];
  const visited = new Set<string>();
  const parents = new Map<string, string>();
  for (const node of byId.values()) {
    const path: ArchitectureNode[] = [];
    const pending = new Set<string>();
    let current: ArchitectureNode | undefined = node;
    while (current && !visited.has(current.id)) {
      path.push(current);
      pending.add(current.id);
      const parent: ArchitectureNode | undefined = current.parentId ? byId.get(current.parentId) : undefined;
      if (!parent || pending.has(parent.id)) break;
      parents.set(current.id, parent.id);
      current = parent;
    }
    for (const entry of path.reverse()) {
      visited.add(entry.id);
      ordered.push(entry);
    }
  }
  const nodes: BrickFlowNode[] = ordered.map(node => {
    const catalog = getCatalogItem(node.kind)!;
    const boundary = catalog.isBoundary;
    const size = effectiveNodeSize(node);
    const width = boundary ? size.width : 174;
    const height = boundary ? size.height : 76;
    return {
      id: node.id,
      type: boundary ? 'boundaryNode' : 'componentBrick',
      parentId: parents.get(node.id),
      position: { x: Number.isFinite(node.position.x) ? node.position.x : 0, y: Number.isFinite(node.position.y) ? node.position.y : 0 },
      data: { architecture: node, catalog },
      selected: node.id === selectedId,
      width, height,
      style: { width, height },
      zIndex: boundary ? 0 : 1000,
      dragHandle: boundary ? '.vcf-canvas__boundary-header' : undefined,
      ariaLabel: `${catalog.label}: ${node.label}`,
    };
  });
  const labels: Record<RelationKind, string> = {
    contains: 'contains', manages: 'manages', 'runs-on': 'runs on',
    'uses-network': 'uses network', 'uses-storage': 'uses storage', connects: 'connects to',
  };
  const edgeIds = new Set<string>();
  const edges: Edge[] = [];
  for (const edge of document.edges) {
    if (!edge.id || edgeIds.has(edge.id) || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    edgeIds.add(edge.id);
    edges.push({
      id: edge.id, source: edge.source, target: edge.target,
      sourceHandle: 'out', targetHandle: 'in',
      type: 'smoothstep', label: labels[edge.kind] ?? edge.kind,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      style: { stroke: '#64748b', strokeWidth: 1.5 },
      labelStyle: { fill: '#334155', fontSize: 11 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.95 },
      labelBgPadding: [6, 3], interactionWidth: 24,
      ariaLabel: `${byId.get(edge.source)!.label} ${labels[edge.kind] ?? edge.kind} ${byId.get(edge.target)!.label}`,
    });
  }
  return { nodes, edges };
}
