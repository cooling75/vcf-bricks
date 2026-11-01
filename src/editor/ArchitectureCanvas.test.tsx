import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchitectureCanvasProps, ArchitectureDocument } from '../contracts';
import { ArchitectureCanvas } from './ArchitectureCanvas';

const document: ArchitectureDocument = {
  schemaVersion: 1, id: 'canvas-test', title: 'Test', profile: 'unspecified', mode: 'sandbox',
  nodes: [{ id: 'host', kind: 'esx-host', label: 'Host A', position: { x: 40, y: 60 }, config: { version: '9', instances: 1, notes: '' } }], edges: [],
};
function props(): ArchitectureCanvasProps {
  return { document, selectedId: null, onSelect: vi.fn(), onMove: vi.fn(), onResize: vi.fn(), onConnect: vi.fn(), onRemoveEdge: vi.fn() };
}

beforeEach(() => {
  // jsdom has no layout/ResizeObserver; keep the actual React Flow renderer under test.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return Number.parseFloat(this.style.width) || 1000; });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return Number.parseFloat(this.style.height) || 700; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ArchitectureCanvas', () => {
  it('renders usable controls and routes node/pane selection to the owner', async () => {
    const callbacks = props();
    const { container } = render(<ArchitectureCanvas {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Fit all' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Host A')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Host A'));
    expect(callbacks.onSelect).toHaveBeenCalledWith('host');
    const pane = container.querySelector('.react-flow__pane')!;
    fireEvent.click(pane);
    expect(callbacks.onSelect).toHaveBeenLastCalledWith(null);
  });
});
