import type { ArchitectureDocument, ArchitectureNode, ComponentKind, Point } from '../contracts';
import { CATALOG, getCatalogItem } from './catalog';
import { addNode, moveNode } from './model';
import { parseProject, serializeProject } from './schema';

import { effectiveNodeSize as sizeOf } from './geometry';
const finitePoint = (point: Point) => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
const coordinateValid = (point: Point) => finitePoint(point) && Math.abs(point.x) <= 100_000 && Math.abs(point.y) <= 100_000;
const COMPACT_SIZES: Partial<Record<ComponentKind, { width: number; height: number }>> = {
  fleet: { width: 1000, height: 720 }, instance: { width: 880, height: 600 },
  'management-domain': { width: 680, height: 440 }, 'workload-domain': { width: 680, height: 440 },
  'vsphere-cluster': { width: 500, height: 320 },
};

/** Top-left first-fit against direct peers; existing width is the wrapping boundary. */
function freeSlot(doc: ArchitectureDocument, node: ArchitectureNode, parentId?: string): Point | undefined {
  const parent = doc.nodes.find(entry => entry.id === parentId);
  const size = sizeOf(node);
  const width = parent ? Math.min(10_000, Math.max(sizeOf(parent).width, size.width + 48)) : Math.max(1200, 4 * (size.width + 24) + 24);
  const bottom = parent ? 10_000 - 24 : 100_000 + size.height;
  const peers = doc.nodes.filter(entry => entry.id !== node.id && entry.parentId === parentId);
  const xs = [...new Set([24, ...peers.map(peer => peer.position.x + sizeOf(peer).width + 24)])].filter(x => x >= 24 && x + size.width + 24 <= width).sort((a, b) => a - b);
  const ys = [...new Set([64, ...peers.map(peer => peer.position.y + sizeOf(peer).height + 24)])].filter(y => y >= 64 && y + size.height <= bottom).sort((a, b) => a - b);
  for (const y of ys) for (const x of xs) {
    if (peers.every(peer => x + size.width + 24 <= peer.position.x || peer.position.x + sizeOf(peer).width + 24 <= x || y + size.height + 24 <= peer.position.y || peer.position.y + sizeOf(peer).height + 24 <= y)) return { x, y };
  }
  return undefined;
}

export function insertNode(doc: ArchitectureDocument, kind: ComponentKind, parentId?: string, absolutePosition?: Point): ArchitectureDocument {
  if (!CATALOG.some(item => item.kind === kind) || !validParent(doc, '', parentId) || (absolutePosition !== undefined && (!finitePoint(absolutePosition) || (parentId === undefined && !coordinateValid(absolutePosition))))) return doc;
  const added = addNode(doc, kind);
  if (added === doc) return doc;
  const created = added.nodes.at(-1)!;
  const compact = COMPACT_SIZES[kind];
  const node = compact ? { ...created, size: { ...compact } } : created;
  const staged = { ...added, nodes: [...added.nodes.slice(0, -1), node] };
  const local = absolutePosition ? undefined : freeSlot(doc, node, parentId);
  if (!absolutePosition && !local) return doc;
  const origin = parentId ? getAbsolutePosition(doc, parentId) : { x: 0, y: 0 };
  const world = absolutePosition ?? { x: local!.x + origin.x, y: local!.y + origin.y };
  const next = relocateNode(staged, node.id, world, parentId);
  if (next === staged && (node.parentId !== parentId || node.position.x !== world.x || node.position.y !== world.y)) return doc;
  return parseProject(serializeProject(next)).ok ? next : doc;
}

export function assignNode(doc: ArchitectureDocument, id: string, parentId?: string): ArchitectureDocument {
  const node = doc.nodes.find(entry => entry.id === id);
  if (!node || node.parentId === parentId || !validParent(doc, id, parentId)) return doc;
  const local = freeSlot(doc, node, parentId);
  if (!local) return doc;
  const origin = parentId ? getAbsolutePosition(doc, parentId) : { x: 0, y: 0 };
  return relocateNode(doc, id, { x: local.x + origin.x, y: local.y + origin.y }, parentId);
}


function validParent(doc: ArchitectureDocument, id: string, parentId?: string): boolean {
  if (parentId === undefined) return true;
  const parent = doc.nodes.find(node => node.id === parentId);
  return !!parent && getCatalogItem(parent.kind).isBoundary && !getDescendantIds(doc, id).has(parentId);
}

/** Commit both hierarchy and position together, then let the model grow ancestors once. */
export function relocateNode(doc: ArchitectureDocument, id: string, absolutePosition: Point, parentId?: string): ArchitectureDocument {
  const node = doc.nodes.find(entry => entry.id === id);
  if (!node || !finitePoint(absolutePosition) || (parentId === undefined && !coordinateValid(absolutePosition)) || !validParent(doc, id, parentId)) return doc;
  const origin = parentId ? getAbsolutePosition(doc, parentId) : { x: 0, y: 0 };
  const size = sizeOf(node);
  if (parentId && (size.width + 48 > 10_000 || size.height + 88 > 10_000)) return doc;
  const position = parentId ? {
    x: Math.max(24, Math.min(10_000 - size.width - 24, absolutePosition.x - origin.x)),
    y: Math.max(64, Math.min(10_000 - size.height - 24, absolutePosition.y - origin.y)),
  } : { ...absolutePosition };
  if (node.parentId === parentId && node.position.x === position.x && node.position.y === position.y) return doc;
  const updated = { ...node, position };
  if (parentId !== undefined) updated.parentId = parentId;
  else delete updated.parentId;
  const staged = { ...doc, nodes: doc.nodes.map(entry => entry.id === id ? updated : entry) };
  const next = moveNode(staged, id, position);
  const path = getNodePath(next, id);
  // The model caps growth; decline instead of letting a grown nested group overflow its ancestor.
  for (let index = 1; index < path.length; index++) {
    const child = path[index], parent = path[index - 1];
    if (child.position.x + sizeOf(child).width + 24 > sizeOf(parent).width || child.position.y + sizeOf(child).height + 24 > sizeOf(parent).height) return doc;
  }
  return parseProject(serializeProject(next)).ok ? next : doc;
}


export function getNodePath(doc: ArchitectureDocument, id?: string): ArchitectureNode[] {
  const path: ArchitectureNode[] = [];
  const visited = new Set<string>();
  let node = doc.nodes.find(entry => entry.id === id);
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    path.unshift(node);
    node = doc.nodes.find(entry => entry.id === node!.parentId);
  }
  return path;
}

export function getAbsolutePosition(doc: ArchitectureDocument, id: string, positionOverride?: Point): Point {
  const path = getNodePath(doc, id);
  if (!path.length) return { x: 0, y: 0 };
  return path.reduce((point, node, index) => {
    const position = index === path.length - 1 ? positionOverride ?? node.position : node.position;
    return { x: point.x + position.x, y: point.y + position.y };
  }, { x: 0, y: 0 });
}

export function getDescendantIds(doc: ArchitectureDocument, id: string): Set<string> {
  const found = new Set([id]);
  let previous = -1;
  while (previous !== found.size) {
    previous = found.size;
    for (const node of doc.nodes) if (node.parentId && found.has(node.parentId)) found.add(node.id);
  }
  return found;
}

export function findDropTarget(doc: ArchitectureDocument, point: Point, excludedId?: string): string | undefined {
  if (!finitePoint(point)) return undefined;
  const excluded = excludedId ? getDescendantIds(doc, excludedId) : new Set<string>();
  return doc.nodes.filter(node => {
    if (excluded.has(node.id) || !getCatalogItem(node.kind).isBoundary) return false;
    const position = getAbsolutePosition(doc, node.id), size = sizeOf(node);
    return point.x >= position.x && point.y >= position.y && point.x <= position.x + size.width && point.y <= position.y + size.height;
  }).sort((a, b) => getNodePath(doc, b.id).length - getNodePath(doc, a.id).length || sizeOf(a).width * sizeOf(a).height - sizeOf(b).width * sizeOf(b).height)[0]?.id;
}
