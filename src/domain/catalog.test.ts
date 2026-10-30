import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORY_LABELS, getCatalogItem } from './catalog';

const kinds = ['fleet', 'instance', 'management-domain', 'workload-domain', 'vsphere-cluster', 'vcenter', 'nsx-manager', 'nsx-edge', 'esx-host', 'vsan', 'external-storage', 'supervisor', 'vsphere-namespace', 'vks-cluster', 'vcf-operations', 'vcf-automation', 'sddc-manager', 'network'];

describe('catalog', () => {
  it('offers all 18 distinct contract kinds with display metadata', () => {
    expect(CATALOG.map(item => item.kind).sort()).toEqual([...kinds].sort());
    for (const item of CATALOG) {
      expect(getCatalogItem(item.kind)).toEqual(item);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.color).toMatch(/^#[a-f0-9]{6}$/i);
      expect(CATEGORY_LABELS[item.category]).toBeTruthy();
    }
  });
  it('only treats the five logical scope kinds as boundaries', () => {
    expect(CATALOG.filter(item => item.isBoundary).map(item => item.kind)).toEqual(kinds.slice(0, 5));
    expect(getCatalogItem('vks-cluster').label).toContain('vSphere Kubernetes Service');
  });
});
