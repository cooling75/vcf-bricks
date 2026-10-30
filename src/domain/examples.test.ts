import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { parseProject, serializeProject } from './schema';
import { getCatalogItem } from './catalog';

describe('synthetic workshop examples', () => {
  it('exports two distinct, documented and schema-valid examples', () => {
    expect(EXAMPLES).toHaveLength(2);
    expect(new Set(EXAMPLES.map(e => e.id)).size).toBe(2);
    for (const example of EXAMPLES) {
      expect(example.name).toBeTruthy();
      expect(example.description).toMatch(/fiktiv|synthetisch/i);
      expect(example.description).toMatch(/keine offizielle/i);
      expect(parseProject(serializeProject(example.document))).toEqual({ ok: true, value: example.document });
      expect(example.document.nodes.length).toBeGreaterThan(10);
      expect(example.document.edges.length).toBeGreaterThan(2);
    }
  });
  it('demonstrates Fleet > instance > management and workload domains', () => {
    const example = EXAMPLES.find(e => !e.document.nodes.some(n => n.kind === 'vks-cluster'))!;
    const fleet = example.document.nodes.find(n => n.kind === 'fleet')!;
    const instance = example.document.nodes.find(n => n.kind === 'instance')!;
    expect(instance.parentId).toBe(fleet.id);
    for (const kind of ['management-domain', 'workload-domain']) {
      expect(example.document.nodes.find(n => n.kind === kind)!.parentId).toBe(instance.id);
    }
  });
  it('distinguishes the Supervisor, namespace and VKS workloadcluster in its VKS example', () => {
    const example = EXAMPLES.find(e => e.document.nodes.some(n => n.kind === 'vks-cluster'))!;
    for (const kind of ['supervisor', 'vsphere-namespace', 'vks-cluster', 'vsphere-cluster']) {
      expect(example.document.nodes.some(n => n.kind === kind)).toBe(true);
    }
    expect(example.description).toContain('vSphere Kubernetes Service');
  });
  it('keeps every child inside simple generously sized logical boundaries', () => {
    for (const { document } of EXAMPLES) {
      for (const node of document.nodes) {
        if (!node.parentId) continue;
        const parent = document.nodes.find(n => n.id === node.parentId)!;
        expect(getCatalogItem(parent.kind).isBoundary).toBe(true);
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(48);
        expect(node.position.x + (node.size?.width ?? 180)).toBeLessThanOrEqual(parent.size!.width);
        expect(node.position.y + (node.size?.height ?? 80)).toBeLessThanOrEqual(parent.size!.height);
      }
    }
  });
});
