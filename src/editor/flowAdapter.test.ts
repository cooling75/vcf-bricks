import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument, ArchitectureNode } from '../contracts';
import { toFlowGraph } from './flowAdapter';
import { findDropTarget, insertNode, assignNode } from '../domain/placement';
import { parseProject, serializeProject } from '../domain/schema';

function brick(id: string, parentId?: string): ArchitectureNode {
  return { id, kind: 'esx-host', label: id, parentId, position: { x: 30, y: 45 }, config: { version: '', instances: 1, notes: '' } };
}
function document(nodes: ArchitectureNode[]): ArchitectureDocument {
  return { schemaVersion: 1, id: 'test', title: 'Test', profile: 'unspecified', mode: 'sandbox', nodes, edges: [] };
}

describe('toFlowGraph', () => {
  it('keeps valid imported sizeless boundaries at the same rendered size after placement', () => {
    const parsed = parseProject(serializeProject(document([{...brick('fleet'),kind:'fleet',position:{x:0,y:0}},brick('leaf')])));
    if (!parsed.ok) throw new Error('Fixture must import');
    const point = {x:300,y:200};
    const inserted = insertNode(parsed.value,'network',findDropTarget(parsed.value,point),point);
    const assigned = assignNode(inserted,'leaf','fleet');
    const graph = toFlowGraph(assigned,null);
    expect(graph.nodes[0]).toMatchObject({id:'fleet',width:600,height:380,style:{width:600,height:380}});
    expect(graph.nodes.find(node=>node.id===inserted.nodes.at(-1)!.id)).toMatchObject({parentId:'fleet',position:point,width:174,height:76});
    expect(graph.nodes.find(node=>node.id==='leaf')).toMatchObject({parentId:'fleet',width:174,height:76});
  });
  it('replaces non-finite positions and sizes with usable geometry', () => {
    const broken = { ...brick('fleet'), kind: 'fleet' as const, position: { x: NaN, y: Infinity }, size: { width: -1, height: NaN } };
    const graph = toFlowGraph(document([broken]), null);
    expect(graph.nodes[0]).toMatchObject({ position: { x: 0, y: 0 }, width: 600, height: 380 });
  });
  it('maps labelled directed links and removes dangling or duplicate links without changing source data', () => {
    const source = document([brick('a'), brick('b')]);
    source.edges = [
      { id: 'link', source: 'a', target: 'b', kind: 'manages' },
      { id: 'link', source: 'b', target: 'a', kind: 'connects' },
      { id: 'missing', source: 'a', target: 'absent', kind: 'connects' },
    ];
    const graph = toFlowGraph(source, null);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ id: 'link', source: 'a', target: 'b', label: 'manages', sourceHandle: 'out', targetHandle: 'in' });
    expect(graph.edges[0].markerEnd).toBeTruthy();
    expect(source.edges).toHaveLength(3);
  });
  it('fails safe on duplicate IDs, dangling parents, self parents and cycles without mutating the document', () => {
    const source = document([
      { ...brick('a', 'b'), kind: 'fleet' },
      { ...brick('b', 'a'), kind: 'instance' },
      brick('orphan', 'missing'), brick('self', 'self'), brick('a'),
    ]);
    const before = JSON.stringify(source);
    const graph = toFlowGraph(source, null);
    expect(graph.nodes.map(node => node.id)).toEqual(['b', 'a', 'orphan', 'self']);
    expect(graph.nodes.find(node => node.id === 'b')?.parentId).toBeUndefined();
    expect(graph.nodes.find(node => node.id === 'a')?.parentId).toBe('b');
    expect(graph.nodes.find(node => node.id === 'orphan')?.parentId).toBeUndefined();
    expect(graph.nodes.find(node => node.id === 'self')?.parentId).toBeUndefined();
    expect(JSON.stringify(source)).toBe(before);
  });
  it('maps nested nodes parent-first while retaining relative positions and controlled selection', () => {
    const root = { ...brick('fleet'), kind: 'fleet' as const, size: { width: 900, height: 600 } };
    const instance = { ...brick('instance', 'fleet'), kind: 'instance' as const };
    const graph = toFlowGraph(document([brick('host', 'instance'), instance, root]), 'host');
    expect(graph.nodes.map(node => node.id)).toEqual(['fleet', 'instance', 'host']);
    expect(graph.nodes[2]).toMatchObject({ parentId: 'instance', position: { x: 30, y: 45 }, selected: true, type: 'componentBrick' });
    expect(graph.nodes[0]).toMatchObject({ type: 'boundaryNode', width: 900, height: 600, selected: false });
    expect(graph.nodes[2].zIndex).toBeGreaterThan(graph.nodes[0].zIndex ?? 0);
  });
});

describe('English relationship labels', () => {
 it.each([['contains','contains'],['manages','manages'],['runs-on','runs on'],['uses-network','uses network'],['uses-storage','uses storage'],['connects','connects to']] as const)('renders %s in English without changing labels or keys', (kind,label) => {
  const source = document([{...brick('a'),label:'Mein Baustein'}, {...brick('b'),label:'Mein Ziel'}]);
  source.edges = [{id:'relation',source:'a',target:'b',kind}];
  const before = JSON.stringify(source);
  const edge = toFlowGraph(source,null).edges[0];
  expect(edge.label).toBe(label);
  expect(edge.ariaLabel).toBe(`Mein Baustein ${label} Mein Ziel`);
  expect(JSON.stringify(source)).toBe(before);
 });
});
