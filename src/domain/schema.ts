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
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${path}: A plain object is required.`);
  const record = value as RecordValue;
  for (const key of Object.keys(record)) if (forbidden.has(key) || !fields.includes(key)) fail(`${path}: Unexpected field “${key}”.`);
  for (const key of required) if (!Object.hasOwn(record, key)) fail(`${path}: Missing field “${key}”.`);
  return record;
}
function text(value: unknown, max: number, path: string, nonempty = false): string {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(`${path}: Invalid text (maximum ${max} characters${nonempty ? ', cannot be blank' : ''}).`);
  return value;
}
function numeric(value: unknown, min: number, max: number, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${path}: ${integer ? 'An integer' : 'A finite number'} between ${min} and ${max} is required.`);
  return value;
}
function choice<T extends string>(value: unknown, allowed: Set<string>, path: string): T {
  if (typeof value !== 'string' || !allowed.has(value)) fail(`${path}: Invalid or unsupported value.`);
  return value as T;
}
function list(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(`${path}: An array with at most ${max} entries is required.`);
  return value;
}
function identifier(value: unknown, used: Set<string>, path: string): string {
  const id = text(value, 120, path, true);
  if (used.has(id)) fail(`${path}: ID “${id}” is not unique.`);
  used.add(id);
  return id;
}

/** Strict, defensive import. Input never becomes a UI object or HTML. */
export function parseProject(input: string): ParseResult {
  try {
    if (typeof input !== 'string') return { ok: false, errors: ['The project file must contain text.'] };
    if (input.length > MAX_IMPORT_BYTES || new TextEncoder().encode(input).byteLength > MAX_IMPORT_BYTES) return { ok: false, errors: ['The project file must not exceed 1 MiB.'] };
    const raw: unknown = JSON.parse(input, (key: string, value: unknown) => {
      if (forbidden.has(key)) fail(`Unexpected field “${key}” in the project file.`);
      return value;
    });
    const root = object(raw, ['schemaVersion', 'id', 'title', 'profile', 'mode', 'nodes', 'edges'], ['schemaVersion', 'id', 'title', 'profile', 'mode', 'nodes', 'edges'], 'Project');
    if (root.schemaVersion !== 1) fail('Unsupported schema version. Only schemaVersion 1 is allowed.');
    const used = new Set<string>();
    const id = identifier(root.id, used, 'Project ID');
    const title = text(root.title, 200, 'Project title', true);
    const profile = choice<ArchitectureDocument['profile']>(root.profile, new Set(['unspecified', 'vcf-9.0', 'vcf-9.1']), 'Project profile');
    const mode = choice<ArchitectureDocument['mode']>(root.mode, new Set(['as-is', 'to-be', 'sandbox']), 'Project mode');
    const nodes: ArchitectureNode[] = list(root.nodes, 200, 'Components').map((entry, index) => {
      const path = `Component ${index + 1}`;
      const n = object(entry, ['id', 'kind', 'label', 'position', 'parentId', 'size', 'config'], ['id', 'kind', 'label', 'position', 'config'], path);
      const position = object(n.position, ['x', 'y'], ['x', 'y'], `${path}: Position`);
      const config = object(n.config, ['version', 'instances', 'notes'], ['version', 'instances', 'notes'], `${path}: Configuration`);
      const node: ArchitectureNode = {
        id: identifier(n.id, used, `${path}: ID`), kind: choice<ComponentKind>(n.kind, kinds, `${path}: Kind`),
        label: text(n.label, 200, `${path}: Label`, true),
        position: { x: numeric(position.x, -100_000, 100_000, `${path}: X`), y: numeric(position.y, -100_000, 100_000, `${path}: Y`) },
        config: { version: text(config.version, 80, `${path}: Version`), instances: numeric(config.instances, 1, 10_000, `${path}: Instance count`, true), notes: text(config.notes, 4000, `${path}: Notes`) },
      };
      if (Object.hasOwn(n, 'parentId')) node.parentId = text(n.parentId, 120, `${path}: Parent ID`, true);
      if (Object.hasOwn(n, 'size')) {
        const size = object(n.size, ['width', 'height'], ['width', 'height'], `${path}: Size`);
        node.size = { width: numeric(size.width, 80, 10_000, `${path}: Width`), height: numeric(size.height, 60, 10_000, `${path}: Height`) };
      }
      return node;
    });
    const byId = new Map(nodes.map(node => [node.id, node]));
    for (const node of nodes) {
      if (node.parentId) {
        const parent = byId.get(node.parentId);
        if (!parent) fail(`Component “${node.label}”: Parent scope is missing.`);
        if (!boundaries.has(parent.kind)) fail(`Component “${node.label}”: Only logical scopes can be parents.`);
      }
      const visited = new Set([node.id]);
      let parentId = node.parentId;
      while (parentId) {
        if (visited.has(parentId)) fail(`Component “${node.label}”: Cycle in the scope hierarchy.`);
        visited.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
    }
    const edgeKeys = new Set<string>();
    const edges: ArchitectureEdge[] = list(root.edges, 400, 'Relationships').map((entry, index) => {
      const path = `Relationship ${index + 1}`;
      const e = object(entry, ['id', 'source', 'target', 'kind'], ['id', 'source', 'target', 'kind'], path);
      const edge: ArchitectureEdge = { id: identifier(e.id, used, `${path}: ID`), source: text(e.source, 120, `${path}: Source`, true), target: text(e.target, 120, `${path}: Target`, true), kind: choice<RelationKind>(e.kind, relations, `${path}: Kind`) };
      if (!byId.has(edge.source) || !byId.has(edge.target)) fail(`${path}: Source or target refers to a missing component.`);
      if (edge.source === edge.target) fail(`${path}: Self-links are not allowed.`);
      const key = JSON.stringify([edge.source, edge.target, edge.kind]);
      if (edgeKeys.has(key)) fail(`${path}: An identical relationship already exists.`);
      edgeKeys.add(key);
      return edge;
    });
    return { ok: true, value: { schemaVersion: 1, id, title, profile, mode, nodes, edges } };
  } catch (error) {
    return { ok: false, errors: [error instanceof InvalidProject ? error.message : 'The project file does not contain valid JSON.'] };
  }
}

export function serializeProject(doc: ArchitectureDocument): string {
  return JSON.stringify(doc, null, 2);
}
