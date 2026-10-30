/** Shared contracts. Framework-independent; persistent data is never React Flow internals. */
export type ComponentKind = 'fleet' | 'instance' | 'management-domain' | 'workload-domain' | 'vsphere-cluster' | 'vcenter' | 'nsx-manager' | 'nsx-edge' | 'esx-host' | 'vsan' | 'external-storage' | 'supervisor' | 'vsphere-namespace' | 'vks-cluster' | 'vcf-operations' | 'vcf-automation' | 'sddc-manager' | 'network';
export type Category = 'boundaries' | 'management' | 'network' | 'compute' | 'kubernetes';
export type RelationKind = 'contains' | 'manages' | 'runs-on' | 'uses-network' | 'uses-storage' | 'connects';
export interface Point { x: number; y: number }
export interface ArchitectureNode {
  id: string; kind: ComponentKind; label: string; position: Point;
  parentId?: string; size?: { width: number; height: number };
  config: { version: string; instances: number; notes: string };
}
export interface ArchitectureEdge { id: string; source: string; target: string; kind: RelationKind }
export interface ArchitectureDocument {
  schemaVersion: 1; id: string; title: string;
  profile: 'unspecified' | 'vcf-9.0' | 'vcf-9.1';
  mode: 'as-is' | 'to-be' | 'sandbox'; nodes: ArchitectureNode[]; edges: ArchitectureEdge[];
}
export interface CatalogItem {
  kind: ComponentKind; label: string; category: Category; color: string;
  shortLabel: string; description: string; isBoundary: boolean;
}
export interface ArchitectureHint { id: string; severity: 'info' | 'warning'; message: string; nodeIds: string[]; source?: string }
export type ParseResult = { ok: true; value: ArchitectureDocument } | { ok: false; errors: string[] };
export interface ArchitectureCanvasProps {
  document: ArchitectureDocument; selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: Point) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onConnect: (source: string, target: string) => void;
  onRemoveEdge: (id: string) => void;
  /** Explicit insertion target; independent from transient selection. */
  insertionTargetId?: string | null;
  /** HTML catalog drop in absolute canvas coordinates. */
  onPlace?: (kind: ComponentKind, position: Point, parentId?: string) => void;
  /** Atomic gesture: reparent and move together, in absolute canvas coordinates. */
  onRelocate?: (id: string, position: Point, parentId?: string) => void;
  focusRequest?: { id: string; sequence: number } | null;
}

export const CATALOG_DRAG_TYPE = 'application/x-vcf-bricks-kind';
