import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument, ComponentKind } from '../contracts';
import { CATALOG } from './catalog';
import { addNode, connectNodes, createEmptyDocument, duplicateNode, moveNode, removeEdge, removeNode, reparentNode, resizeNode, updateNode } from './model';

function add(doc: ArchitectureDocument, kind: ComponentKind, parentId?: string) {
  const next = addNode(doc, kind, parentId);
  return { doc: next, node: next.nodes.at(-1)! };
}

describe('immutable architecture model', () => {
  it('creates independent empty documents with valid defaults and unique IDs', () => {
    const a = createEmptyDocument(), b = createEmptyDocument();
    expect(a).toMatchObject({ schemaVersion: 1, profile: 'unspecified', mode: 'sandbox', nodes: [], edges: [] });
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBeTruthy();
    expect(a.nodes).not.toBe(b.nodes);
  });
  it('adds all kinds with labels, fresh config, finite positions and boundary dimensions', () => {
    let doc = createEmptyDocument();
    for (const item of CATALOG) doc = addNode(doc, item.kind);
    expect(doc.nodes).toHaveLength(18);
    expect(new Set(doc.nodes.map(node => node.id)).size).toBe(18);
    for (const node of doc.nodes) {
      expect(node.label).toBe(CATALOG.find(item => item.kind === node.kind)!.label);
      expect(node.config).toEqual({ version: '', instances: 1, notes: '' });
      expect(Number.isFinite(node.position.x)).toBe(true);
      if (CATALOG.find(item => item.kind === node.kind)!.isBoundary) {
        expect(node.size!.width).toBeGreaterThanOrEqual(300);
        expect(node.size!.height).toBeGreaterThanOrEqual(200);
      }
    }
  });
  it('adds children at distinct relative positions and expands their boundary if necessary', () => {
    const root = add(createEmptyDocument(), 'fleet');
    let doc = root.doc;
    for (let i = 0; i < 12; i++) doc = addNode(doc, 'vcenter', root.node.id);
    const parent = doc.nodes[0];
    const children = doc.nodes.slice(1);
    expect(new Set(children.map(n => JSON.stringify(n.position))).size).toBe(12);
    for (const child of children) {
      expect(child.parentId).toBe(parent.id);
      expect(child.position.x).toBeGreaterThanOrEqual(0);
      expect(child.position.y).toBeGreaterThanOrEqual(40);
      expect(child.position.x + 180).toBeLessThanOrEqual(parent.size!.width);
      expect(child.position.y + 80).toBeLessThanOrEqual(parent.size!.height);
    }
    expect(root.doc.nodes).toHaveLength(1);
    expect(addNode(doc, 'vcenter', 'missing')).toBe(doc);
    expect(addNode(doc, 'vcenter', children[0].id)).toBe(doc);
  });
  it('updates user fields without mutation, merges config, and protects identity and parenting', () => {
    const { doc, node } = add(createEmptyDocument(), 'vcenter');
    const next = updateNode(doc, node.id, { label: '<b>Plaintext</b>', config: { version: '9.1', instances: 2, notes: 'Test' }, id: 'changed', parentId: 'missing', kind: 'fleet' });
    expect(next.nodes[0]).toMatchObject({ id: node.id, kind: 'vcenter', label: '<b>Plaintext</b>', config: { version: '9.1', instances: 2, notes: 'Test' } });
    expect(next.nodes[0].parentId).toBeUndefined();
    expect(doc.nodes[0].label).not.toBe(next.nodes[0].label);
    expect(updateNode(doc, 'missing', { label: 'x' })).toBe(doc);
    expect(updateNode(doc, node.id, { config: { version: '', instances: -1, notes: '' } })).toBe(doc);
  });
  it('moves and resizes safely, rejecting nonfinite and oversized values', () => {
    const { doc, node } = add(createEmptyDocument(), 'fleet');
    const moved = moveNode(doc, node.id, { x: -50, y: 60 });
    expect(moved.nodes[0].position).toEqual({ x: -50, y: 60 });
    expect(resizeNode(moved, node.id, { width: 800, height: 600 }).nodes[0].size).toEqual({ width: 800, height: 600 });
    expect(moveNode(doc, node.id, { x: Infinity, y: 0 })).toBe(doc);
    expect(resizeNode(doc, node.id, { width: -1, height: 0 })).toBe(doc);
    expect(resizeNode(doc, node.id, { width: 100_001, height: 500 })).toBe(doc);
  });
  it('connects nodes once per directed relation, rejecting self and dangling references', () => {
    let doc = addNode(addNode(createEmptyDocument(), 'vcenter'), 'esx-host');
    const [a, b] = doc.nodes;
    expect(connectNodes(doc, a.id, a.id)).toBe(doc);
    expect(connectNodes(doc, a.id, 'missing')).toBe(doc);
    doc = connectNodes(doc, a.id, b.id, 'manages');
    expect(doc.edges[0]).toMatchObject({ source: a.id, target: b.id, kind: 'manages' });
    expect(connectNodes(doc, a.id, b.id, 'manages')).toBe(doc);
    expect(connectNodes(doc, a.id, b.id, 'runs-on').edges).toHaveLength(2);
    const defaultRelation = connectNodes(doc, b.id, a.id);
    expect(defaultRelation.edges.at(-1)!.kind).toBe('connects');
    expect(removeEdge(doc, doc.edges[0].id).edges).toEqual([]);
    expect(removeEdge(doc, 'missing')).toBe(doc);
  });
  it('deletes boundary descendants and every incident edge, preserving unrelated items', () => {
    const fleet = add(createEmptyDocument(), 'fleet');
    const instance = add(fleet.doc, 'instance', fleet.node.id);
    const child = add(instance.doc, 'vcenter', instance.node.id);
    const outside = add(child.doc, 'network');
    const doc = connectNodes(outside.doc, child.node.id, outside.node.id);
    const next = removeNode(doc, fleet.node.id);
    expect(next.nodes.map(n => n.id)).toEqual([outside.node.id]);
    expect(next.edges).toEqual([]);
    expect(doc.nodes).toHaveLength(4);
    expect(removeNode(doc, 'missing')).toBe(doc);
  });
  it('duplicates a complete subtree with fresh IDs and only internal edges', () => {
    const group = add(createEmptyDocument(), 'workload-domain');
    const child = add(group.doc, 'supervisor', group.node.id);
    const second = add(child.doc, 'vks-cluster', group.node.id);
    const outside = add(second.doc, 'network');
    let doc = connectNodes(outside.doc, child.node.id, second.node.id, 'manages');
    doc = connectNodes(doc, child.node.id, outside.node.id, 'uses-network');
    const next = duplicateNode(doc, group.node.id);
    expect(next.nodes).toHaveLength(7);
    expect(next.edges).toHaveLength(3);
    expect(new Set(next.nodes.map(n => n.id)).size).toBe(7);
    const clone = next.nodes[4];
    expect(clone.parentId).toBeUndefined();
    expect(clone.position).not.toEqual(group.node.position);
    expect(next.nodes.slice(5).every(n => n.parentId === clone.id)).toBe(true);
    expect(next.edges[2].source).toBe(next.nodes[5].id);
    expect(next.edges[2].target).toBe(next.nodes[6].id);
    next.nodes[5].config.notes = 'copy only';
    expect(child.node.config.notes).toBe('');
    expect(duplicateNode(doc, 'missing')).toBe(doc);
  });
  it('duplicates ordinary components without copying external connections', () => {
    const a = add(createEmptyDocument(), 'vcenter');
    const next = duplicateNode(a.doc, a.node.id);
    expect(next.nodes).toHaveLength(2);
    expect(next.nodes[1].id).not.toBe(a.node.id);
    expect(next.nodes[1].label).toContain('Kopie');
    expect(next.edges).toEqual([]);
  });
  it('reparents using boundary parents, preserving absolute coordinates and preventing cycles', () => {
    const fleet = add(createEmptyDocument(), 'fleet');
    let doc = moveNode(fleet.doc, fleet.node.id, { x: 100, y: 100 });
    const instance = add(doc, 'instance', fleet.node.id);
    const child = add(instance.doc, 'vcenter');
    doc = moveNode(child.doc, child.node.id, { x: 700, y: 600 });
    const next = reparentNode(doc, child.node.id, fleet.node.id);
    expect(next.nodes[2].position).toEqual({ x: 600, y: 500 });
    expect(next.nodes[2].parentId).toBe(fleet.node.id);
    expect(reparentNode(next, child.node.id).nodes[2].position).toEqual({ x: 700, y: 600 });
    expect(reparentNode(doc, fleet.node.id, instance.node.id)).toBe(doc);
    expect(reparentNode(doc, fleet.node.id, fleet.node.id)).toBe(doc);
    expect(reparentNode(doc, fleet.node.id, child.node.id)).toBe(doc);
    expect(reparentNode(doc, child.node.id, 'missing')).toBe(doc);
  });
  it('keeps a maximum-size boundary palette exportable and children inside the size ceiling', async () => {
    const { parseProject, serializeProject } = await import('./schema');
    let doc = createEmptyDocument();
    for (let i = 0; i < 200; i++) doc = addNode(doc, 'fleet');
    expect(doc.nodes).toHaveLength(200);
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
    let nested = addNode(createEmptyDocument(), 'fleet');
    const rootId = nested.nodes[0].id;
    for (let i = 0; i < 100; i++) nested = addNode(nested, 'fleet', rootId);
    for (const child of nested.nodes.slice(1)) {
      expect(child.position.x + child.size!.width).toBeLessThanOrEqual(nested.nodes[0].size!.width);
      expect(child.position.y + child.size!.height).toBeLessThanOrEqual(nested.nodes[0].size!.height);
    }
    expect(parseProject(serializeProject(nested)).ok).toBe(true);
  });
  it('enforces document limits before adding or duplicating nodes and edges', () => {
    let doc = createEmptyDocument();
    for (let i = 0; i < 200; i++) doc = addNode(doc, 'network');
    expect(addNode(doc, 'network')).toBe(doc);
    expect(duplicateNode(doc, doc.nodes[0].id)).toBe(doc);
    for (let i = 0; i < 400; i++) {
      const a = doc.nodes[Math.floor(i / 199)];
      const b = doc.nodes[(i % 199) + 1];
      doc = connectNodes(doc, a.id, b.id, i < 199 ? 'connects' : 'uses-network');
    }
    // Build a guaranteed full set without self links.
    for (let i = 0; doc.edges.length < 400; i++) doc = connectNodes(doc, doc.nodes[3].id, doc.nodes[4 + i].id);
    expect(doc.edges).toHaveLength(400);
    expect(connectNodes(doc, doc.nodes[0].id, doc.nodes[5].id, 'manages')).toBe(doc);
  });
});
