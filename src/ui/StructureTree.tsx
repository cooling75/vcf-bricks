import { useEffect, useState } from 'react';
import type { ArchitectureNode } from '../contracts';
import { getCatalogItem } from '../domain/catalog';

interface Props {
  nodes: ArchitectureNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StructureTree({ nodes, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const ancestors = new Set<string>();
  let parentId = nodes.find(node => node.id === selectedId)?.parentId;
  while (parentId && !ancestors.has(parentId)) {
    ancestors.add(parentId);
    parentId = nodes.find(node => node.id === parentId)?.parentId;
  }
  const ancestorKey = JSON.stringify([...ancestors]);
  useEffect(() => {
    const selectedAncestors = new Set<string>(JSON.parse(ancestorKey));
    setCollapsed(current => new Set([...current].filter(id => !selectedAncestors.has(id))));
  }, [selectedId, ancestorKey]);

  function branch(parentId?: string, visited = new Set<string>()): React.ReactNode {
    return <ul className="structure-tree">{nodes.filter(node => node.parentId === parentId && !visited.has(node.id)).map(node => {
      const children = nodes.some(child => child.parentId === node.id);
      const hidden = collapsed.has(node.id);
      return <li key={node.id}>
        <div className={`structure-tree-row ${node.id === selectedId ? 'selected' : ''}`}>
          {children ? <button type="button" className="tree-toggle" aria-label={`${hidden ? 'Expand' : 'Collapse'} ${node.label}`} aria-expanded={!hidden}
            onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}>{hidden ? '▸' : '▾'}</button> : <span className="tree-toggle-spacer" />}
          <button className="structure-item" aria-label={`Select ${node.label}`} onClick={() => onSelect(node.id)}>
            <span className="structure-dot" style={{ background: getCatalogItem(node.kind).color }} />
            <span><strong>{node.label}</strong><small>{getCatalogItem(node.kind).label}</small></span>
          </button>
        </div>
        {children && !hidden && branch(node.id, new Set([...visited, node.id]))}
      </li>;
    })}</ul>;
  }
  return <nav aria-label="Architecture structure">{branch()}</nav>;
}
