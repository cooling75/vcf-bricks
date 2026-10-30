import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Background, BackgroundVariant, Controls, Handle, NodeResizer, Panel, Position,
  ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow,
} from '@xyflow/react';
import type { Connection, NodeChange, NodeProps, NodeTypes } from '@xyflow/react';
import type { ArchitectureCanvasProps } from '../contracts';
import { toFlowGraph } from './flowAdapter';
import type { BrickFlowNode } from './flowAdapter';
import '@xyflow/react/dist/style.css';
import './canvas.css';

const ResizeContext = createContext<ArchitectureCanvasProps['onResize']>(() => undefined);

function ConnectionHandles() {
  return <>
    <Handle id="in" type="target" position={Position.Left} aria-label="Verbindungsziel" />
    <Handle id="out" type="source" position={Position.Right} aria-label="Verbindung beginnen" />
  </>;
}

function ComponentBrick({ data, selected }: NodeProps<BrickFlowNode>) {
  const { architecture: node, catalog } = data;
  return <div className={`vcf-canvas__brick${selected ? ' is-selected' : ''}`} style={{ '--brick-color': catalog.color } as CSSProperties}>
    <ConnectionHandles />
    <span className="vcf-canvas__brick-type">{catalog.shortLabel}</span>
    <strong className="vcf-canvas__brick-name" title={node.label}>{node.label || catalog.label}</strong>
    <span className="vcf-canvas__brick-meta">{node.config.version ? `v${node.config.version} · ` : ''}{node.config.instances}×</span>
  </div>;
}

function BoundaryNode({ id, data, selected }: NodeProps<BrickFlowNode>) {
  const resize = useContext(ResizeContext);
  const { architecture: node, catalog } = data;
  return <div className={`vcf-canvas__boundary${selected ? ' is-selected' : ''}`} style={{ '--brick-color': catalog.color } as CSSProperties}>
    <NodeResizer isVisible={selected} minWidth={260} minHeight={160} color={catalog.color}
      onResizeEnd={(_, size) => resize(id, { width: Math.round(size.width), height: Math.round(size.height) })} />
    <ConnectionHandles />
    <div className="vcf-canvas__boundary-header" title={`${catalog.label}: ${node.label}`}>
      <span className="vcf-canvas__boundary-kind">{catalog.shortLabel}</span>
      <strong>{node.label || catalog.label}</strong>
    </div>
  </div>;
}

const nodeTypes: NodeTypes = { componentBrick: ComponentBrick, boundaryNode: BoundaryNode };

function FitViewButton() {
  const { fitView } = useReactFlow();
  return <button className="vcf-canvas__button" type="button" onClick={() => void fitView({ padding: 0.12, duration: 250, maxZoom: 1 })}>
    <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M7 7h6v6H7z" /></svg>
    Alles einpassen
  </button>;
}

function CanvasContent({ document, selectedId, onSelect, onMove, onResize, onConnect, onRemoveEdge }: ArchitectureCanvasProps) {
  const descriptionId = useId();
  const graph = useMemo(() => toFlowGraph(document, selectedId), [document, selectedId]);
  // Only transient gesture geometry lives here. The owner's document always wins.
  const [nodes, setNodes] = useState(graph.nodes);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  useEffect(() => setNodes(graph.nodes), [graph.nodes]);
  const activeEdge = graph.edges.find(edge => edge.id === activeEdgeId);
  const edges = useMemo(() => graph.edges.map(edge => ({ ...edge, selected: edge.id === activeEdgeId })), [graph.edges, activeEdgeId]);
  const changeNodes = useCallback((changes: NodeChange<BrickFlowNode>[]) => {
    // Selection and deletion are owned by the application, not React Flow internals.
    setNodes(current => applyNodeChanges(changes.filter(change => change.type === 'position' || change.type === 'dimensions'), current));
  }, []);
  const connect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) onConnect(connection.source, connection.target);
  }, [onConnect]);

  return <section className="vcf-canvas" aria-label="Architektur-Baufläche" aria-describedby={descriptionId}
    onKeyDownCapture={event => {
      const target = event.target as Element;
      if (!(target instanceof Element) || target.closest('button, input, textarea, select')) return;
      const nodeId = target.closest('.react-flow__node')?.getAttribute('data-id');
      const edgeId = target.closest('.react-flow__edge')?.getAttribute('data-id');
      if (event.key === 'Enter' || event.key === ' ') {
        if (nodeId) { event.preventDefault(); event.stopPropagation(); setActiveEdgeId(null); onSelect(nodeId); }
        else if (edgeId) { event.preventDefault(); event.stopPropagation(); setActiveEdgeId(edgeId); onSelect(null); }
      }
      if (edgeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); event.stopPropagation(); onRemoveEdge(edgeId); setActiveEdgeId(null);
      }
    }}>
    <p id={descriptionId} className="vcf-canvas__sr-only">Bausteine ziehen. Bereiche am Titel bewegen und nach Auswahl am Rahmen vergrößern. Von einem rechten Anschlusspunkt zu einem linken ziehen, um eine Verbindung zu erstellen. Verbindung auswählen und über den eingeblendeten Knopf entfernen. Alternativ Bausteinliste und Eigenschaften neben der Baufläche verwenden.</p>
    <ResizeContext.Provider value={onResize}>
      <ReactFlow<BrickFlowNode>
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={changeNodes}
        onNodeDragStop={(_, node) => onMove(node.id, { x: node.position.x, y: node.position.y })}
        onNodeClick={(_, node) => { setActiveEdgeId(null); onSelect(node.id); }}
        onPaneClick={() => { setActiveEdgeId(null); onSelect(null); }}
        onEdgeClick={(_, edge) => { setActiveEdgeId(edge.id); onSelect(null); }}
        onConnect={connect}
        disableKeyboardA11y
        fitView fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.08} maxZoom={2} connectionRadius={24}
        deleteKeyCode={null} multiSelectionKeyCode={null}
        elevateNodesOnSelect={false} selectNodesOnDrag={false}
        nodesFocusable edgesFocusable
        ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Vergrößern', 'controls.zoomOut.ariaLabel': 'Verkleinern', 'controls.fitView.ariaLabel': 'Ansicht einpassen' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#c9d5e3" />
        <Controls showInteractive={false} showFitView={false} />
        <Panel position="top-right"><FitViewButton /></Panel>
        {activeEdge && <Panel position="bottom-center">
          <div className="vcf-canvas__edge-actions">
            <span>{String(activeEdge.label)}</span>
            <button className="vcf-canvas__button vcf-canvas__button--danger" type="button" onClick={() => { onRemoveEdge(activeEdge.id); setActiveEdgeId(null); }}>Verbindung entfernen</button>
          </div>
        </Panel>}
        {!graph.nodes.length && <Panel position="top-center"><div className="vcf-canvas__empty">Baustein aus der Palette hinzufügen, um zu beginnen.</div></Panel>}
      </ReactFlow>
    </ResizeContext.Provider>
  </section>;
}

/** Controlled 2D renderer. Persistence, validation and keyboard-editable lists belong to the owner. */
export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return <ReactFlowProvider><CanvasContent {...props} /></ReactFlowProvider>;
}
