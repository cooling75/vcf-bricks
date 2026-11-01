import { cleanup, createEvent, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchitectureCanvasProps, ArchitectureDocument } from '../contracts';
import { CATALOG_DRAG_TYPE } from '../contracts';
import { ArchitectureCanvas } from './ArchitectureCanvas';

const flow = vi.hoisted(() => ({ props: {} as Record<string, any>, fitView: vi.fn(), zoomTo: vi.fn(), screenToFlowPosition: vi.fn((p: { x: number; y: number }) => ({ x: p.x - 100, y: p.y - 50 })) }));
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return { ...actual, ReactFlowProvider: ({ children }: any) => children,
    useReactFlow: () => flow,
    ReactFlow: (props: any) => { flow.props = props; return <div>{props.nodes.map((node: any) => { const Component = props.nodeTypes[node.type]; return <Component key={node.id} {...node} />; })}{props.children}</div>; },
    Handle: () => null, NodeResizer: () => null, Background: () => null, Controls: () => null,
    Panel: ({ children }: any) => <div>{children}</div>,
  };
});
const config = { version: '', instances: 1, notes: '' };
const doc: ArchitectureDocument = { schemaVersion: 1, id: 'd', title: '', mode: 'sandbox', profile: 'unspecified', edges: [], nodes: [
  { id: 'outer', kind: 'fleet', label: 'Outer', position: { x: 0, y: 0 }, size: { width: 900, height: 700 }, config },
  { id: 'inner', kind: 'instance', label: 'Inner', position: { x: 100, y: 100 }, parentId: 'outer', size: { width: 400, height: 300 }, config },
  { id: 'host', kind: 'esx-host', label: 'Host', position: { x: 20, y: 30 }, parentId: 'inner', config },
] };
function props(): ArchitectureCanvasProps { return { document: doc, selectedId: 'host', onSelect: vi.fn(), onMove: vi.fn(), onResize: vi.fn(), onConnect: vi.fn(), onRemoveEdge: vi.fn(), onPlace: vi.fn(), onRelocate: vi.fn() }; }
function catalogEvent(type: 'dragOver' | 'drop', canvas: HTMLElement, clientX: number, clientY: number, kind: string) {
  const event = createEvent[type](canvas, { dataTransfer: transfer(kind) });
  Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY } });
  fireEvent(canvas, event);
}
const transfer = (kind: string) => ({ types: [CATALOG_DRAG_TYPE], getData: () => kind, dropEffect: 'none' });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('canvas placement gestures', () => {
  it('transforms catalog drop coordinates, highlights deepest boundary, and clears feedback', () => {
    const p = props(); const { container } = render(<ArchitectureCanvas {...p} insertionTargetId="outer" />);
    const canvas = screen.getByRole('region', { name: 'Architecture canvas' });
    catalogEvent('dragOver', canvas, 300, 250, 'esx-host');
    expect(container.querySelector('[data-drop-target="inner"]')).toBeInTheDocument();
    expect(container.querySelector('[data-insertion-target="outer"]')).toBeInTheDocument();
    catalogEvent('drop', canvas, 300, 250, 'esx-host');
    expect(p.onPlace).toHaveBeenCalledWith('esx-host', { x: 200, y: 200 }, 'inner');
    expect(container.querySelector('[data-drop-target]')).not.toBeInTheDocument();
    catalogEvent('drop', canvas, 1200, 1000, 'esx-host');
    expect(p.onPlace).toHaveBeenLastCalledWith('esx-host', { x: 1100, y: 950 }, undefined);
    catalogEvent('drop', canvas, 300, 250, 'invalid');
    expect(p.onPlace).toHaveBeenCalledTimes(2);
  });
  it('rejects readable invalid drags and clears feedback when leaving the canvas', () => {
    const p = props(); const { container } = render(<ArchitectureCanvas {...p} />);
    const canvas = screen.getByRole('region', { name: 'Architecture canvas' });
    catalogEvent('dragOver', canvas, 300, 250, 'invalid');
    expect(container.querySelector('[data-drop-target]')).not.toBeInTheDocument();
    // Real browsers hide the payload during dragover but preserve the MIME type.
    catalogEvent('dragOver', canvas, 300, 250, '');
    expect(container.querySelector('[data-drop-target="inner"]')).toBeInTheDocument();
    fireEvent.dragLeave(canvas);
    expect(container.querySelector('[data-drop-target]')).not.toBeInTheDocument();
    catalogEvent('drop', canvas, NaN, 250, 'esx-host');
    expect(p.onPlace).not.toHaveBeenCalled();
  });
  it('relocates using actual absolute top-left but chooses parent from pointer, with legacy fallback', () => {
    const p = props(); const { rerender } = render(<ArchitectureCanvas {...p} />);
    const node = { ...flow.props.nodes.find((n: any) => n.id === 'host'), position: { x: 40, y: 50 } };
    act(() => flow.props.onNodeDragStart({ clientX: 800, clientY: 600 }, node));
    act(() => flow.props.onNodeDragStop({ clientX: 800, clientY: 600 }, node));
    expect(p.onRelocate).toHaveBeenCalledWith('host', { x: 140, y: 150 }, 'outer');
    expect(p.onMove).not.toHaveBeenCalled();
    rerender(<ArchitectureCanvas {...p} onRelocate={undefined} />);
    act(() => flow.props.onNodeDragStop({ clientX: 800, clientY: 600 }, node));
    expect(p.onMove).toHaveBeenCalledWith('host', { x: 40, y: 50 });
  });
  it('never targets a dragged boundary or descendant and preserves transient position on selection changes', () => {
    const p = props(); const { rerender, container } = render(<ArchitectureCanvas {...p} />);
    const node = { ...flow.props.nodes.find((n: any) => n.id === 'outer'), position: { x: 30, y: 40 } };
    act(() => flow.props.onNodeDragStart({ clientX: 300, clientY: 250 }, node));
    act(() => flow.props.onNodesChange([{ type: 'position', id: 'outer', position: node.position, dragging: true }]));
    act(() => flow.props.onNodeDrag({ clientX: 300, clientY: 250 }, node));
    expect(container.querySelector('[data-drop-target]')).not.toBeInTheDocument();
    rerender(<ArchitectureCanvas {...p} selectedId="outer" />);
    expect(flow.props.nodes.find((n: any) => n.id === 'outer').position).toEqual({ x: 30, y: 40 });
    act(() => flow.props.onNodeDragStop({ clientX: 300, clientY: 250 }, node));
    expect(p.onRelocate).toHaveBeenCalledWith('outer', { x: 30, y: 40 }, undefined);
  });
  it('restores canonical geometry when the owner declines a drag', () => {
    const p = props(); render(<ArchitectureCanvas {...p} />);
    const node = { ...flow.props.nodes.find((n: any) => n.id === 'host'), position: { x: 400, y: 500 } };
    act(() => flow.props.onNodeDragStart({ clientX: 900, clientY: 900 }, node));
    act(() => flow.props.onNodesChange([{ type: 'position', id: 'host', position: node.position, dragging: true }]));
    expect(flow.props.nodes.find((n: any) => n.id === 'host').position).toEqual({ x: 400, y: 500 });
    // The owner deliberately leaves its document unchanged.
    act(() => flow.props.onNodeDragStop({ clientX: 900, clientY: 900 }, node));
    expect(flow.props.nodes.find((n: any) => n.id === 'host').position).toEqual(doc.nodes[2].position);
  });
  it('focuses only explicit requests, and offers selected focus plus 100% controls', () => {
    const p = props(); const { rerender } = render(<ArchitectureCanvas {...p} />);
    expect(flow.fitView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Focus selection' }));
    expect(flow.fitView).toHaveBeenLastCalledWith(expect.objectContaining({ nodes: [{ id: 'host' }], maxZoom: 1 }));
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(flow.zoomTo).toHaveBeenCalledWith(1, expect.any(Object));
    rerender(<ArchitectureCanvas {...p} focusRequest={{ id: 'inner', sequence: 1 }} />);
    expect(flow.fitView).toHaveBeenLastCalledWith(expect.objectContaining({ nodes: [{ id: 'inner' }], maxZoom: 1 }));
    const calls = flow.fitView.mock.calls.length;
    rerender(<ArchitectureCanvas {...p} document={{ ...doc, title: 'typing' }} focusRequest={{ id: 'inner', sequence: 1 }} />);
    expect(flow.fitView).toHaveBeenCalledTimes(calls);
  });
});
