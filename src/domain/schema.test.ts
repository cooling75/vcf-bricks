import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../contracts';
import { CATALOG } from './catalog';
import { addNode, connectNodes, createEmptyDocument } from './model';
import { MAX_IMPORT_BYTES, parseProject, serializeProject } from './schema';

function fixture(): ArchitectureDocument {
  let doc = addNode(createEmptyDocument(), 'fleet');
  doc = addNode(doc, 'instance', doc.nodes[0].id);
  doc = addNode(doc, 'vcenter', doc.nodes[1].id);
  return connectNodes(doc, doc.nodes[2].id, doc.nodes[1].id, 'manages');
}
function reject(doc: unknown) {
  const result = parseProject(JSON.stringify(doc));
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/[äöüÄÖÜß]|Datei|Projekt|Feld|Ungültig|nicht|muss|darf|Baustein|Verbindung|Schema|Grenze/);
  }
}

describe('strict version-one project JSON', () => {
  it('round trips every catalog kind, relation and plaintext without shared objects', () => {
    let doc = createEmptyDocument();
    for (const item of CATALOG) doc = addNode(doc, item.kind);
    for (const kind of ['contains', 'manages', 'runs-on', 'uses-network', 'uses-storage', 'connects'] as const) doc = connectNodes(doc, doc.nodes[0].id, doc.nodes[1].id, kind);
    doc.nodes[0].label = '<script>alert("x")</script>';
    doc.nodes[0].config.notes = '日本語 – Notizen\nmit <b>HTML als Text</b>';
    const result = parseProject(serializeProject(doc));
    expect(result).toEqual({ ok: true, value: doc });
    if (result.ok) {
      expect(result.value).not.toBe(doc);
      expect(result.value.nodes[0].config).not.toBe(doc.nodes[0].config);
      expect(Object.getPrototypeOf(result.value.nodes[0])).toBe(Object.prototype);
    }
  });
  it.each(['', '{', 'null', '[]', 'true', '42', '"text"'])('returns German errors without throwing for %j', input => {
    expect(() => parseProject(input)).not.toThrow();
    expect(parseProject(input).ok).toBe(false);
  });
  it('limits UTF-8 byte size to exactly one MiB before JSON parsing', () => {
    expect(MAX_IMPORT_BYTES).toBe(1_048_576);
    const text = serializeProject(createEmptyDocument());
    expect(parseProject(text + ' '.repeat(MAX_IMPORT_BYTES - new TextEncoder().encode(text).length)).ok).toBe(true);
    expect(parseProject(text + ' '.repeat(MAX_IMPORT_BYTES)).ok).toBe(false);
    expect(parseProject('é'.repeat(MAX_IMPORT_BYTES / 2 + 1)).ok).toBe(false);
  });
  it.each(['__proto__', 'constructor', 'prototype'])('rejects the prototype key %s at every object depth', key => {
    const doc = fixture();
    const text = JSON.stringify(doc);
    expect(parseProject(text.replace('"version":""', `"version":"","${key}":{}`)).ok).toBe(false);
    expect(parseProject(text.replace('"schemaVersion":1', `"schemaVersion":1,"${key}":{}`)).ok).toBe(false);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it('rejects unknown schema versions, missing fields, invalid enums and non-array collections', () => {
    for (const schemaVersion of [0, 2, '1', null]) reject({ ...fixture(), schemaVersion });
    for (const patch of [{ title: undefined }, { id: '' }, { title: 'x'.repeat(201) }, { profile: 'vcf-8' }, { mode: 'live' }, { nodes: {} }, { edges: null }, { nodes: undefined }]) reject({ ...fixture(), ...patch });
  });
  it('rejects additional fields at root, node, position, size, config and edge levels', () => {
    const mutations = [
      (d: any) => { d.extra = true; },
      (d: any) => { d.nodes[0].selected = true; },
      (d: any) => { d.nodes[0].position.z = 1; },
      (d: any) => { d.nodes[0].size.depth = 1; },
      (d: any) => { d.nodes[0].config.secret = true; },
      (d: any) => { d.edges[0].animated = true; },
    ];
    for (const mutate of mutations) { const doc = fixture(); mutate(doc); reject(doc); }
  });
  it('rejects invalid kinds, required fields, sizes, coordinates, strings and quantities', () => {
    const mutations = [
      (d: any) => { d.nodes[0].kind = 'unknown'; },
      (d: any) => { delete d.nodes[0].config; },
      (d: any) => { d.nodes[0].label = ''; },
      (d: any) => { d.nodes[0].id = 'x'.repeat(121); },
      (d: any) => { d.nodes[0].position.x = 100_001; },
      (d: any) => { d.nodes[0].position.y = null; },
      (d: any) => { d.nodes[0].position.x = '0'; },
      (d: any) => { d.nodes[0].position = []; },
      (d: any) => { d.nodes[0].size.width = -1; },
      (d: any) => { d.nodes[0].size.height = 10_001; },
      (d: any) => { d.nodes[0].config.instances = 1.5; },
      (d: any) => { d.nodes[0].config.instances = 0; },
      (d: any) => { d.nodes[0].config.instances = 10_001; },
      (d: any) => { d.nodes[0].config.version = 'v'.repeat(81); },
      (d: any) => { d.nodes[0].config.notes = 'x'.repeat(4001); },
      (d: any) => { d.nodes[0].config = null; },
      (d: any) => { d.edges[0].kind = 'required'; },
    ];
    for (const mutate of mutations) { const doc = fixture(); mutate(doc); reject(doc); }
    const text = serializeProject(fixture());
    expect(parseProject(text.replace(/"x":\s*24/, '"x":1e999')).ok).toBe(false);
  });
  it('accepts negative finite coordinates and exact size/string/quantity bounds', () => {
    const doc = fixture();
    doc.nodes[0].position = { x: -100_000, y: 100_000 };
    doc.nodes[0].size = { width: 80, height: 60 };
    doc.nodes[0].config = { version: 'v'.repeat(80), notes: 'x'.repeat(4000), instances: 10_000 };
    doc.nodes[0].label = 'x'.repeat(200);
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
  });
  it('rejects duplicate identifiers and invalid edge references, self links and duplicate relations', () => {
    for (const mutate of [
      (d: any) => { d.nodes[1].id = d.nodes[0].id; },
      (d: any) => { d.edges[0].id = d.nodes[0].id; },
      (d: any) => { d.edges.push({ ...d.edges[0] }); },
      (d: any) => { d.edges[0].target = 'missing'; },
      (d: any) => { d.edges[0].source = 'missing'; },
      (d: any) => { d.edges[0].target = d.edges[0].source; },
      (d: any) => { d.edges.push({ ...d.edges[0], id: 'duplicate-relation' }); },
    ]) { const doc = fixture(); mutate(doc); reject(doc); }
  });
  it('rejects missing, component and cyclic parents but accepts out-of-order valid parents', () => {
    for (const mutate of [
      (d: any) => { d.nodes[0].parentId = 'missing'; },
      (d: any) => { d.nodes[0].parentId = d.nodes[2].id; },
      (d: any) => { d.nodes[0].parentId = d.nodes[0].id; },
      (d: any) => { d.nodes[0].parentId = d.nodes[1].id; },
    ]) { const doc = fixture(); mutate(doc); reject(doc); }
    const doc = fixture();
    doc.nodes.reverse();
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
  });
  it('accepts 200 nodes and 400 edges, rejects the next entry', () => {
    const doc = fixture();
    doc.nodes = Array.from({ length: 200 }, (_, i) => ({ ...doc.nodes[0], id: `node-${i}` }));
    doc.edges = Array.from({ length: 400 }, (_, i) => ({ id: `edge-${i}`, source: `node-${Math.floor(i / 199)}`, target: `node-${i % 199 + 1}`, kind: i < 199 ? 'connects' as const : 'manages' as const })).filter(e => e.source !== e.target);
    // Fill the two self-link gaps with distinct valid relations.
    while (doc.edges.length < 400) doc.edges.push({ id: `fill-${doc.edges.length}`, source: 'node-4', target: `node-${doc.edges.length - 390}`, kind: 'connects' });
    expect(parseProject(serializeProject(doc)).ok).toBe(true);
    reject({ ...doc, nodes: [...doc.nodes, { ...doc.nodes[0], id: 'overflow-node' }] });
    reject({ ...doc, edges: [...doc.edges, { id: 'overflow-edge', source: 'node-5', target: 'node-6', kind: 'manages' }] });
  });
});
