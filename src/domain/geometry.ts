import type { ArchitectureNode } from '../contracts';
import { getCatalogItem } from './catalog';

/** Boundary geometry is shared by rendering, hit testing, packing and containment. */
export function effectiveNodeSize(node: ArchitectureNode): { width: number; height: number } {
  const fallback = getCatalogItem(node.kind).isBoundary ? { width: 600, height: 380 } : { width: 180, height: 80 };
  return {
    width: Number.isFinite(node.size?.width) && node.size!.width > 0 ? node.size!.width : fallback.width,
    height: Number.isFinite(node.size?.height) && node.size!.height > 0 ? node.size!.height : fallback.height,
  };
}
