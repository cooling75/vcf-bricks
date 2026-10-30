import type { ArchitectureDocument, ArchitectureNode, ComponentKind, Point, RelationKind } from '../contracts';
import { CATALOG, getCatalogItem } from './catalog';

const MAX_NODES = 200;
const MAX_EDGES = 400;
const COORDINATE_LIMIT = 100_000;
const RELATIONS: RelationKind[] = ['contains', 'manages', 'runs-on', 'uses-network', 'uses-storage', 'connects'];
let sequence = 0;
function freshId(prefix: string, occupied: Set<string> = new Set()): string {
  let id: string;
  do {
    id = `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(++sequence).toString(36)}`}`;
  } while (occupied.has(id));
  occupied.add(id);
  return id;
}
const ids = (doc: ArchitectureDocument) => new Set([doc.id, ...doc.nodes.map(n => n.id), ...doc.edges.map(e => e.id)]);
const boundary = (node: ArchitectureNode) => getCatalogItem(node.kind).isBoundary;
const pointValid = (p: Point) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= COORDINATE_LIMIT && Math.abs(p.y) <= COORDINATE_LIMIT;
const sizeValid = (s: { width: number; height: number }) => !!s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width >= 80 && s.height >= 60 && s.width <= 10_000 && s.height <= 10_000;
const textValid = (s: string, max: number) => typeof s === 'string' && s.length <= max;
const dimensions = (node: ArchitectureNode) => node.size ?? { width: 180, height: 80 };
const DEFAULT_SIZES: Partial<Record<ComponentKind, { width: number; height: number }>> = {
  fleet: { width: 1600, height: 1100 }, instance: { width: 1360, height: 900 },
  'management-domain': { width: 1100, height: 760 }, 'workload-domain': { width: 1100, height: 760 },
  'vsphere-cluster': { width: 860, height: 560 },
};

/** Expand logical boundaries for visible children. Does not imply physical hosting. */
function containChildren(doc: ArchitectureDocument): ArchitectureDocument {
  let nodes = doc.nodes;
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    nodes = nodes.map(node => {
      if (!boundary(node)) return node;
      const children = nodes.filter(child => child.parentId === node.id);
      const current = dimensions(node);
      const width = Math.min(10_000, Math.max(current.width, ...children.map(child => child.position.x + dimensions(child).width + 24)));
      const height = Math.min(10_000, Math.max(current.height, ...children.map(child => child.position.y + dimensions(child).height + 24)));
      if (width === current.width && height === current.height) return node;
      changed = true;
      return { ...node, size: { width, height } };
    });
    if (!changed) break;
  }
  return { ...doc, nodes };
}

export function createEmptyDocument(): ArchitectureDocument {
  return { schemaVersion: 1, id: freshId('project'), title: 'Neue VCF-Architektur', profile: 'unspecified', mode: 'sandbox', nodes: [], edges: [] };
}

export function addNode(doc: ArchitectureDocument, kind: ComponentKind, parentId?: string): ArchitectureDocument {
  if (doc.nodes.length >= MAX_NODES || !CATALOG.some(item => item.kind === kind)) return doc;
  if (parentId && !doc.nodes.some(node => node.id === parentId && boundary(node))) return doc;
  const peers = doc.nodes.filter(node => node.parentId === parentId);
  const width = Math.max(180, ...peers.map(node => dimensions(node).width), DEFAULT_SIZES[kind]?.width ?? 180);
  const height = Math.max(80, ...peers.map(node => dimensions(node).height), DEFAULT_SIZES[kind]?.height ?? 80);
  const columns = parentId ? Math.max(1, Math.min(4, Math.floor((10_000 - 24) / (width + 24)))) : 4;
  const position = { x: 24 + (peers.length % columns) * (width + 24), y: 64 + Math.floor(peers.length / columns) * (height + 24) };
  const size = DEFAULT_SIZES[kind];
  // At the size ceiling, decline an insertion rather than placing it outside its scope.
  if (parentId && (position.x + (size?.width ?? 180) + 24 > 10_000 || position.y + (size?.height ?? 80) + 24 > 10_000)) return doc;
  const node: ArchitectureNode = { id: freshId('node', ids(doc)), kind, label: getCatalogItem(kind).label, position,
    ...(parentId ? { parentId } : {}), ...(size ? { size: { ...size } } : {}), config: { version: '', instances: 1, notes: '' } };
  return containChildren({ ...doc, nodes: [...doc.nodes, node] });
}

export function updateNode(doc: ArchitectureDocument, id: string, patch: Partial<ArchitectureNode>): ArchitectureDocument {
  const node = doc.nodes.find(entry => entry.id === id);
  if (!node) return doc;
  const config = { ...node.config, ...patch.config };
  const label = patch.label ?? node.label;
  const position = patch.position ?? node.position;
  const size = patch.size ?? node.size;
  if (!textValid(label, 200) || !label.trim() || !textValid(config.version, 80) || !textValid(config.notes, 4000) || !Number.isInteger(config.instances) || config.instances < 1 || config.instances > 10_000 || !pointValid(position) || (size && !sizeValid(size))) return doc;
  const updated: ArchitectureNode = { ...node, label, position: { x: position.x, y: position.y }, config: { version: config.version, instances: config.instances, notes: config.notes }, ...(size ? { size: { width: size.width, height: size.height } } : {}) };
  return containChildren({ ...doc, nodes: doc.nodes.map(entry => entry.id === id ? updated : entry) });
}

export function moveNode(doc: ArchitectureDocument, id: string, position: Point): ArchitectureDocument {
  return updateNode(doc, id, { position });
}
export function resizeNode(doc: ArchitectureDocument, id: string, size: { width: number; height: number }): ArchitectureDocument {
  return updateNode(doc, id, { size });
}

function descendants(doc: ArchitectureDocument, id: string): Set<string> {
  const found = new Set([id]);
  for (let pass = 0; pass < doc.nodes.length; pass++) {
    const before = found.size;
    for (const node of doc.nodes) if (node.parentId && found.has(node.parentId)) found.add(node.id);
    if (found.size === before) break;
  }
  return found;
}

export function removeNode(doc: ArchitectureDocument, id: string): ArchitectureDocument {
  if (!doc.nodes.some(node => node.id === id)) return doc;
  const removed = descendants(doc, id);
  return { ...doc, nodes: doc.nodes.filter(node => !removed.has(node.id)), edges: doc.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)) };
}

export function duplicateNode(doc: ArchitectureDocument, id: string): ArchitectureDocument {
  const root = doc.nodes.find(node => node.id === id);
  if (!root) return doc;
  const included = descendants(doc, id);
  const sourceNodes = doc.nodes.filter(node => included.has(node.id));
  const sourceEdges = doc.edges.filter(edge => included.has(edge.source) && included.has(edge.target));
  if (doc.nodes.length + sourceNodes.length > MAX_NODES || doc.edges.length + sourceEdges.length > MAX_EDGES) return doc;
  const occupied = ids(doc);
  const mapping = new Map(sourceNodes.map(node => [node.id, freshId('node', occupied)]));
  const copies = sourceNodes.map(node => {
    const copy: ArchitectureNode = { ...node, id: mapping.get(node.id)!, position: { ...node.position }, config: { ...node.config }, ...(node.size ? { size: { ...node.size } } : {}) };
    if (node.id === id) {
      copy.label = `${node.label.slice(0, 192)} (Kopie)`;
      copy.position = { x: Math.min(COORDINATE_LIMIT, node.position.x + 40), y: Math.min(COORDINATE_LIMIT, node.position.y + 40) };
    } else if (node.parentId) copy.parentId = mapping.get(node.parentId)!;
    return copy;
  });
  return containChildren({ ...doc, nodes: [...doc.nodes, ...copies], edges: [...doc.edges, ...sourceEdges.map(edge => ({ ...edge, id: freshId('edge', occupied), source: mapping.get(edge.source)!, target: mapping.get(edge.target)! }))] });
}

export function connectNodes(doc: ArchitectureDocument, source: string, target: string, kind: RelationKind = 'connects'): ArchitectureDocument {
  if (doc.edges.length >= MAX_EDGES || source === target || !RELATIONS.includes(kind) || !doc.nodes.some(node => node.id === source) || !doc.nodes.some(node => node.id === target) || doc.edges.some(edge => edge.source === source && edge.target === target && edge.kind === kind)) return doc;
  return { ...doc, edges: [...doc.edges, { id: freshId('edge', ids(doc)), source, target, kind }] };
}
export function removeEdge(doc: ArchitectureDocument, id: string): ArchitectureDocument {
  if (!doc.edges.some(edge => edge.id === id)) return doc;
  return { ...doc, edges: doc.edges.filter(edge => edge.id !== id) };
}

function absolutePosition(doc: ArchitectureDocument, node: ArchitectureNode): Point {
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = doc.nodes.find(entry => entry.id === parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

export function reparentNode(doc: ArchitectureDocument, id: string, parentId?: string): ArchitectureDocument {
  const node = doc.nodes.find(entry => entry.id === id);
  if (!node || node.parentId === parentId) return doc;
  const parent = parentId ? doc.nodes.find(entry => entry.id === parentId) : undefined;
  if (parentId && (!parent || !boundary(parent) || descendants(doc, id).has(parentId))) return doc;
  const from = absolutePosition(doc, node);
  const to = parent ? absolutePosition(doc, parent) : { x: 0, y: 0 };
  const position = { x: from.x - to.x, y: from.y - to.y };
  if (!pointValid(position)) return doc;
  const updated = { ...node, position };
  if (parentId) updated.parentId = parentId;
  else delete updated.parentId;
  return containChildren({ ...doc, nodes: doc.nodes.map(entry => entry.id === id ? updated : entry) });
}
