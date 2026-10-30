import type { ArchitectureDocument, ArchitectureEdge, ArchitectureNode, ComponentKind, ParseResult, RelationKind } from '../contracts';
import { CATALOG } from './catalog';

export const MAX_IMPORT_BYTES = 1_048_576;
const kinds = new Set<string>(CATALOG.map(item => item.kind));
const boundaries = new Set<string>(CATALOG.filter(item => item.isBoundary).map(item => item.kind));
const relations = new Set<string>(['contains', 'manages', 'runs-on', 'uses-network', 'uses-storage', 'connects']);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

type RecordValue = Record<string, unknown>;
class InvalidProject extends Error {}
function fail(message: string): never { throw new InvalidProject(message); }
function object(value: unknown, fields: string[], required: string[], path: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${path}: Ein eigenes Objekt wird benötigt.`);
  const record = value as RecordValue;
  for (const key of Object.keys(record)) if (forbidden.has(key) || !fields.includes(key)) fail(`${path}: Unerlaubtes Feld „${key}“.`);
  for (const key of required) if (!Object.hasOwn(record, key)) fail(`${path}: Das Feld „${key}“ fehlt.`);
  return record;
}
function text(value: unknown, max: number, path: string, nonempty = false): string {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(`${path}: Ungültiger Text (maximal ${max} Zeichen${nonempty ? ', nicht leer' : ''}).`);
  return value;
}
function numeric(value: unknown, min: number, max: number, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${path}: Eine ${integer ? 'ganze' : 'endliche'} Zahl von ${min} bis ${max} wird benötigt.`);
  return value;
}
function choice<T extends string>(value: unknown, allowed: Set<string>, path: string): T {
  if (typeof value !== 'string' || !allowed.has(value)) fail(`${path}: Ungültiger oder nicht unterstützter Wert.`);
  return value as T;
}
function list(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(`${path}: Eine Liste mit maximal ${max} Einträgen wird benötigt.`);
  return value;
}
function identifier(value: unknown, used: Set<string>, path: string): string {
  const id = text(value, 120, path, true);
  if (used.has(id)) fail(`${path}: Die ID „${id}“ ist nicht eindeutig.`);
  used.add(id);
  return id;
}

/** Strict, defensive import. Input never becomes a UI object or HTML. */
export function parseProject(input: string): ParseResult {
  try {
    if (typeof input !== 'string') return { ok: false, errors: ['Die Projektdatei muss Text enthalten.'] };
    if (input.length > MAX_IMPORT_BYTES || new TextEncoder().encode(input).byteLength > MAX_IMPORT_BYTES) return { ok: false, errors: ['Die Projektdatei darf höchstens 1 MiB groß sein.'] };
    const raw: unknown = JSON.parse(input, (key: string, value: unknown) => {
      if (forbidden.has(key)) fail(`Unerlaubtes Feld „${key}“ in der Projektdatei.`);
      return value;
    });
    const root = object(raw, ['schemaVersion', 'id', 'title', 'profile', 'mode', 'nodes', 'edges'], ['schemaVersion', 'id', 'title', 'profile', 'mode', 'nodes', 'edges'], 'Projekt');
    if (root.schemaVersion !== 1) fail('Nicht unterstützte Schema-Version. Nur schemaVersion 1 ist erlaubt.');
    const used = new Set<string>();
    const id = identifier(root.id, used, 'Projekt-ID');
    const title = text(root.title, 200, 'Projekttitel', true);
    const profile = choice<ArchitectureDocument['profile']>(root.profile, new Set(['unspecified', 'vcf-9.0', 'vcf-9.1']), 'Projektprofil');
    const mode = choice<ArchitectureDocument['mode']>(root.mode, new Set(['as-is', 'to-be', 'sandbox']), 'Projektmodus');
    const nodes: ArchitectureNode[] = list(root.nodes, 200, 'Bausteine').map((entry, index) => {
      const path = `Baustein ${index + 1}`;
      const n = object(entry, ['id', 'kind', 'label', 'position', 'parentId', 'size', 'config'], ['id', 'kind', 'label', 'position', 'config'], path);
      const position = object(n.position, ['x', 'y'], ['x', 'y'], `${path}: Position`);
      const config = object(n.config, ['version', 'instances', 'notes'], ['version', 'instances', 'notes'], `${path}: Konfiguration`);
      const node: ArchitectureNode = {
        id: identifier(n.id, used, `${path}: ID`), kind: choice<ComponentKind>(n.kind, kinds, `${path}: Typ`),
        label: text(n.label, 200, `${path}: Name`, true),
        position: { x: numeric(position.x, -100_000, 100_000, `${path}: X`), y: numeric(position.y, -100_000, 100_000, `${path}: Y`) },
        config: { version: text(config.version, 80, `${path}: Version`), instances: numeric(config.instances, 1, 10_000, `${path}: Anzahl`, true), notes: text(config.notes, 4000, `${path}: Notizen`) },
      };
      if (Object.hasOwn(n, 'parentId')) node.parentId = text(n.parentId, 120, `${path}: Eltern-ID`, true);
      if (Object.hasOwn(n, 'size')) {
        const size = object(n.size, ['width', 'height'], ['width', 'height'], `${path}: Größe`);
        node.size = { width: numeric(size.width, 80, 10_000, `${path}: Breite`), height: numeric(size.height, 60, 10_000, `${path}: Höhe`) };
      }
      return node;
    });
    const byId = new Map(nodes.map(node => [node.id, node]));
    for (const node of nodes) {
      if (node.parentId) {
        const parent = byId.get(node.parentId);
        if (!parent) fail(`Baustein „${node.label}“: Der übergeordnete Bereich fehlt.`);
        if (!boundaries.has(parent.kind)) fail(`Baustein „${node.label}“: Nur logische Bereiche dürfen Eltern sein.`);
      }
      const visited = new Set([node.id]);
      let parentId = node.parentId;
      while (parentId) {
        if (visited.has(parentId)) fail(`Baustein „${node.label}“: Zyklus in der Bereichshierarchie.`);
        visited.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
    }
    const edgeKeys = new Set<string>();
    const edges: ArchitectureEdge[] = list(root.edges, 400, 'Verbindungen').map((entry, index) => {
      const path = `Verbindung ${index + 1}`;
      const e = object(entry, ['id', 'source', 'target', 'kind'], ['id', 'source', 'target', 'kind'], path);
      const edge: ArchitectureEdge = { id: identifier(e.id, used, `${path}: ID`), source: text(e.source, 120, `${path}: Quelle`, true), target: text(e.target, 120, `${path}: Ziel`, true), kind: choice<RelationKind>(e.kind, relations, `${path}: Typ`) };
      if (!byId.has(edge.source) || !byId.has(edge.target)) fail(`${path}: Quelle oder Ziel verweist auf einen fehlenden Baustein.`);
      if (edge.source === edge.target) fail(`${path}: Selbstverbindungen sind nicht erlaubt.`);
      const key = JSON.stringify([edge.source, edge.target, edge.kind]);
      if (edgeKeys.has(key)) fail(`${path}: Eine identische Verbindung ist bereits vorhanden.`);
      edgeKeys.add(key);
      return edge;
    });
    return { ok: true, value: { schemaVersion: 1, id, title, profile, mode, nodes, edges } };
  } catch (error) {
    return { ok: false, errors: [error instanceof InvalidProject ? error.message : 'Die Projektdatei enthält kein gültiges JSON.'] };
  }
}

export function serializeProject(doc: ArchitectureDocument): string {
  return JSON.stringify(doc, null, 2);
}
