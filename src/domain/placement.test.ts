import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument, ArchitectureNode, ComponentKind } from '../contracts';
import { createEmptyDocument } from './model';
import { getAbsolutePosition, getDescendantIds, getNodePath, findDropTarget, relocateNode, insertNode, assignNode } from './placement';
import { parseProject, serializeProject } from './schema';

function node(id: string, kind: ComponentKind, x: number, y: number, parentId?: string, width = 500, height = 320): ArchitectureNode {
  return { id, kind, label: id, position: { x, y }, ...(parentId ? { parentId } : {}), size: { width, height }, config: { version: '', instances: 1, notes: '' } };
}
function document(...nodes: ArchitectureNode[]): ArchitectureDocument { return { ...createEmptyDocument(), nodes }; }

describe('free-slot placement', () => {
  it('uses compact defaults for new boundaries without changing existing boundaries', () => {
    const sizes = { fleet: [1000, 720], instance: [880, 600], 'management-domain': [680, 440], 'workload-domain': [680, 440], 'vsphere-cluster': [500, 320] } as const;
    for (const kind of Object.keys(sizes) as (keyof typeof sizes)[]) {
      const next = insertNode(createEmptyDocument(), kind);
      expect(next.nodes[0].size).toEqual({ width: sizes[kind][0], height: sizes[kind][1] });
    }
    const old = document(node('old', 'fleet', 0, 0, undefined, 1600, 1100));
    const next = insertNode(old, 'vcenter', 'old');
    expect(next.nodes[0].size).toEqual({ width: 1600, height: 1100 });
    expect(next.nodes[1].position).toEqual({ x: 24, y: 64 });
    expect(next.nodes[1].size ?? { width: 180, height: 80 }).toEqual({ width: 180, height: 80 });
  });
  it('wraps at current container width, fills holes, and grows vertically', () => {
    let doc = document(node('parent', 'fleet', 0, 0, undefined, 460, 200));
    for (let i = 0; i < 5; i++) doc = insertNode(doc, 'vcenter', 'parent');
    expect(doc.nodes.slice(1).map(n => n.position)).toEqual([{ x: 24, y: 64 }, { x: 228, y: 64 }, { x: 24, y: 168 }, { x: 228, y: 168 }, { x: 24, y: 272 }]);
    expect(doc.nodes[0].size).toEqual({ width: 460, height: 376 });
    const hole = { ...doc, nodes: doc.nodes.filter((_, i) => i !== 2) };
    expect(insertNode(hole, 'vcenter', 'parent').nodes.at(-1)!.position).toEqual({ x: 228, y: 64 });
  });
  it('packs larger logical groups into smaller boundaries without overlap or horizontal sprawl', () => {
    let doc = document(node('parent', 'vsphere-cluster', 0, 0, undefined, 300, 200));
    doc = insertNode(doc, 'instance', 'parent');
    doc = insertNode(doc, 'instance', 'parent');
    expect(doc.nodes[0].size).toEqual({ width: 928, height: 1312 });
    expect(doc.nodes[1].position).toEqual({ x: 24, y: 64 });
    expect(doc.nodes[2].position).toEqual({ x: 24, y: 688 });
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
  });
  it('inserts at explicit world coordinates and assigns whole subtrees to a free slot', () => {
    const initial = document(node('target', 'workload-domain', 100, 200), node('group', 'fleet', 2000, 100), node('child', 'vcenter', 24, 64, 'group', 180, 80));
    const placed = insertNode(initial, 'network', 'target', { x: 200, y: 350 });
    expect(placed.nodes.at(-1)).toMatchObject({ parentId: 'target', position: { x: 100, y: 150 } });
    const next = assignNode(placed, 'group', 'target');
    expect(next.nodes[1].parentId).toBe('target');
    expect(next.nodes[2]).toBe(initial.nodes[2]);
    expect(next.edges).toBe(initial.edges);
    expect(next.nodes[1].position.y).toBeGreaterThanOrEqual(254);
    expect(assignNode(next, 'group', 'target')).toBe(next);
    expect(assignNode(next, 'target', 'group')).toBe(next);
    expect(assignNode(next, 'child', 'missing')).toBe(next);
    expect(assignNode(next, 'missing', 'target')).toBe(next);
    expect(assignNode(next, 'child', placed.nodes.at(-1)!.id)).toBe(next);
    expect(assignNode(next, 'group').nodes[1].parentId).toBeUndefined();
  });
  it('accepts world positions beyond the persisted coordinate cap when local coordinates are valid', () => {
    const doc = document(node('parent', 'fleet', 100000, 100000), node('child', 'vcenter', 0, 0, undefined, 180, 80));
    const inserted = insertNode(doc, 'network', 'parent');
    expect(inserted.nodes.at(-1)).toMatchObject({ parentId: 'parent', position: { x: 24, y: 64 } });
    const assigned = assignNode(doc, 'child', 'parent');
    expect(assigned.nodes[1]).toMatchObject({ parentId: 'parent', position: { x: 24, y: 64 } });
    const moved = relocateNode(doc, 'child', { x: 100100, y: 100200 }, 'parent');
    expect(moved.nodes[1].position).toEqual({ x: 100, y: 200 });
    expect(parseProject(serializeProject(moved)).ok).toBe(true);
  });
  it('preserves schema byte limits with atomic rollback', () => {
    const doc = document(...Array.from({ length: 100 }, (_, i) => node(`n${i}`, 'network', i * 204, 0, undefined, 180, 80)));
    for (const entry of doc.nodes) {
      const remaining = 1048576 - new TextEncoder().encode(serializeProject(doc)).byteLength;
      entry.config.notes = '界'.repeat(Math.min(4000, Math.floor(remaining / 3)));
    }
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
    expect(insertNode(doc, 'network')).toBe(doc);
    expect(relocateNode(doc, 'n0', { x: 100000, y: 100000 })).toBe(doc);
  });
  it('declines invalid inputs, full containers and node limits without partial insertion', () => {
    const doc = document(node('parent', 'fleet', 0, 0, undefined, 10000, 10000), node('full', 'instance', 24, 64, 'parent', 9952, 9912));
    expect(insertNode(doc, 'network', 'parent')).toBe(doc);
    expect(insertNode(doc, 'network', 'missing')).toBe(doc);
    expect(insertNode(doc, 'network', 'full', { x: Infinity, y: 0 })).toBe(doc);
    expect(insertNode(doc, 'bogus' as ComponentKind)).toBe(doc);
    let roots = createEmptyDocument();
    for (let i = 0; i < 200; i++) roots = insertNode(roots, 'fleet');
    expect(roots.nodes).toHaveLength(200);
    expect(insertNode(roots, 'fleet')).toBe(roots);
    expect(parseProject(serializeProject(roots)).ok).toBe(true);
  });
});

describe('atomic relocation', () => {
  it('converts world coordinates once and preserves children, identity, and edges', () => {
    const doc = document(node('target', 'fleet', -100, 200), node('group', 'instance', 1500, 0), node('child', 'vcenter', 24, 64, 'group'));
    doc.edges = [{ id: 'edge', source: 'child', target: 'target', kind: 'connects' }];
    const next = relocateNode(doc, 'group', { x: 0, y: 300 }, 'target');
    expect(next.nodes[1]).toMatchObject({ id: 'group', parentId: 'target', position: { x: 100, y: 100 } });
    expect(next.nodes[2]).toBe(doc.nodes[2]);
    expect(getAbsolutePosition(next, 'child')).toEqual({ x: 24, y: 364 });
    expect(next.edges).toBe(doc.edges);
    expect(doc.nodes[1].position).toEqual({ x: 1500, y: 0 });
    const root = relocateNode(next, 'group', { x: -50, y: -70 });
    expect(root.nodes[1].parentId).toBeUndefined();
    expect(root.nodes[1].position).toEqual({ x: -50, y: -70 });
    expect(relocateNode(root, 'group', { x: -50, y: -70 })).toBe(root);
  });
  it('grows ancestors within their ceilings and rolls back a subtree that cannot fit', () => {
    const doc = document(node('root', 'fleet', 0, 0, undefined, 1000, 720), node('group', 'instance', 24, 64, 'root', 880, 600), node('child', 'network', 0, 0, undefined, 180, 80));
    const next = relocateNode(doc, 'child', { x: 900, y: 700 }, 'group');
    expect(next.nodes[1].size).toEqual({ width: 1080, height: 740 });
    expect(next.nodes[0].size).toEqual({ width: 1128, height: 828 });
    expect(relocateNode(doc, 'child', { x: 99999, y: 99999 }, 'group')).toBe(doc);
    const giant = document(node('root', 'fleet', 0, 0), node('giant', 'instance', 0, 0, undefined, 10000, 10000));
    expect(assignNode(giant, 'giant', 'root')).toBe(giant);
  });
  it('clamps child content clearance and rejects invalid moves atomically', () => {
    const doc = document(node('root', 'fleet', 0, 0), node('group', 'instance', 24, 64, 'root'), node('leaf', 'vcenter', 24, 64, 'group'));
    const next = relocateNode(doc, 'leaf', { x: -500, y: -500 }, 'root');
    expect(next.nodes[2].position).toEqual({ x: 24, y: 64 });
    for (const parent of ['root', 'group', 'leaf']) expect(relocateNode(doc, 'root', { x: 0, y: 0 }, parent)).toBe(doc);
    expect(relocateNode(doc, 'leaf', { x: 0, y: 0 }, 'missing')).toBe(doc);
    expect(relocateNode(doc, 'missing', { x: 0, y: 0 })).toBe(doc);
    expect(relocateNode(doc, 'group', { x: NaN, y: 0 })).toBe(doc);
    expect(relocateNode(doc, 'group', { x: 100001, y: 0 })).toBe(doc);
    expect(relocateNode(doc, 'leaf', { x: 99999, y: 99999 }, 'root').nodes[2].position).toEqual({ x: 9476, y: 9656 });
  });
});

describe('placement geometry', () => {
  it('hits and preserves imported sizeless boundary geometry through insertion and assignment', () => {
    const fleet = node('fleet', 'fleet', 0, 0);
    delete fleet.size;
    const parsed = parseProject(serializeProject(document(fleet, node('leaf', 'vcenter', 900, 0, undefined, 180, 80))));
    if (!parsed.ok) throw new Error('Fixture must be a valid import');
    const doc = parsed.value;
    expect(findDropTarget(doc, { x: 300, y: 200 })).toBe('fleet');
    const inserted = insertNode(doc, 'network', findDropTarget(doc, { x: 300, y: 200 }), { x: 300, y: 200 });
    expect(inserted.nodes.at(-1)).toMatchObject({ parentId: 'fleet', position: { x: 300, y: 200 } });
    expect(inserted.nodes[0].size).toBeUndefined();
    const assigned = assignNode(inserted, 'leaf', 'fleet');
    expect(assigned.nodes[1]).toMatchObject({ parentId: 'fleet', position: { x: 24, y: 64 } });
    expect(assigned.nodes[0].size).toBeUndefined();
    const grown = relocateNode(assigned, 'leaf', { x: 500, y: 300 }, 'fleet');
    expect(grown.nodes[0].size).toEqual({ width: 704, height: 404 });
  });
  it('converts nested relative positions and overrides through all ancestors', () => {
    const doc = document(node('root', 'fleet', -100, 200), node('group', 'instance', 24, 64, 'root'), node('child', 'vcenter', 30, 80, 'group'));
    expect(getAbsolutePosition(doc, 'child')).toEqual({ x: -46, y: 344 });
    expect(getAbsolutePosition(doc, 'child', { x: 10, y: 20 })).toEqual({ x: -66, y: 284 });
    expect(getAbsolutePosition(doc, 'missing')).toEqual({ x: 0, y: 0 });
    expect(getNodePath(doc, 'child').map(n => n.id)).toEqual(['root', 'group', 'child']);
    expect(getNodePath(doc)).toEqual([]);
    expect(getNodePath(doc, 'missing')).toEqual([]);
    expect(getDescendantIds(doc, 'group')).toEqual(new Set(['group', 'child']));
  });
  it('hits the deepest boundary, excluding a dragged group and its subtree', () => {
    const doc = document(node('root', 'fleet', 0, 0, undefined, 1000, 720), node('inner', 'instance', 24, 64, 'root'), node('leaf', 'vcenter', 24, 64, 'inner'));
    expect(findDropTarget(doc, { x: 80, y: 150 })).toBe('inner');
    expect(findDropTarget(doc, { x: 80, y: 150 }, 'inner')).toBe('root');
    expect(findDropTarget(doc, { x: 80, y: 150 }, 'root')).toBeUndefined();
    expect(findDropTarget(doc, { x: -1, y: 0 })).toBeUndefined();
    expect(findDropTarget(doc, { x: NaN, y: 0 })).toBeUndefined();
  });
  it('breaks equal-depth overlapping hits by smaller area, then document order', () => {
    const doc = document(node('large', 'fleet', 0, 0), node('small', 'instance', 0, 0, undefined, 200, 150), node('same', 'instance', 0, 0, undefined, 200, 150));
    expect(findDropTarget(doc, { x: 50, y: 100 })).toBe('small');
  });
});
