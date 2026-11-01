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
  it('uses English categories without changing their stable keys', () => {
    expect(CATEGORY_LABELS).toEqual({ boundaries: 'Logical Scopes', management: 'Management', network: 'Network', compute: 'Compute & Storage', kubernetes: 'Kubernetes' });
  });
  it.each([
    ['fleet', 'VCF Fleet', 'Fleet', 'Logical scope for VCF instances; does not imply physical hosting.'],
    ['instance', 'VCF Instance', 'Instance', 'Logical scope for a VMware Cloud Foundation instance.'],
    ['management-domain', 'Management Domain', 'Mgmt Domain', 'Logical management scope; placement does not imply hosting.'],
    ['workload-domain', 'Workload Domain', 'Workload', 'Logical scope for workloads within a VCF instance.'],
    ['vsphere-cluster', 'vSphere Cluster', 'Cluster', 'Logical grouping of a vSphere cluster, with no fixed host count.'],
    ['vcenter', 'vCenter Server', 'vCenter', 'Manages vSphere resources; relationships can be modeled freely in the workshop.'],
    ['nsx-manager', 'NSX Manager', 'NSX Mgr', 'NSX management component. The instance count is a workshop assumption.'],
    ['nsx-edge', 'NSX Edge', 'NSX Edge', 'Symbol for NSX network services, with no prescribed topology.'],
    ['esx-host', 'ESX Host', 'ESX', 'Abstract host symbol, not a hardware or compatibility guarantee.'],
    ['vsan', 'vSAN', 'vSAN', 'Logical vSAN storage component; does not guarantee capacity or hardware suitability.'],
    ['external-storage', 'External Storage', 'Storage', 'Externally provided storage; assess suitability and connectivity separately.'],
    ['supervisor', 'Supervisor', 'Supervisor', 'vSphere Kubernetes control plane; distinct from a VKS workload cluster.'],
    ['vsphere-namespace', 'vSphere Namespace', 'Namespace', 'Logical vSphere namespace for resources and policies.'],
    ['vks-cluster', 'vSphere Kubernetes Service – Cluster', 'VKS Cluster', 'Kubernetes workload cluster provided by vSphere Kubernetes Service (VKS), separate from the Supervisor.'],
    ['vcf-operations', 'VCF Operations', 'Operations', 'Operations component for the selected logical VCF scope.'],
    ['vcf-automation', 'VCF Automation', 'Automation', 'Automation component; the required configuration depends on the scenario.'],
    ['sddc-manager', 'SDDC Manager', 'SDDC Mgr', 'Management component; check its role and lifecycle relationships for the relevant version.'],
    ['network', 'Network', 'Network', 'Abstract network symbol for connections and scopes with custom labels.'],
  ])('provides English display metadata for %s', (kind, label, shortLabel, description) => {
    expect(CATALOG.find(item => item.kind === kind)).toMatchObject({ label, shortLabel, description });
  });
  it('reports unknown kinds in English', () => {
    expect(() => getCatalogItem('unknown' as never)).toThrow('Unknown component kind.');
  });
  it('only treats the five logical scope kinds as boundaries', () => {
    expect(CATALOG.filter(item => item.isBoundary).map(item => item.kind)).toEqual(kinds.slice(0, 5));
    expect(getCatalogItem('vks-cluster').label).toContain('vSphere Kubernetes Service');
  });
});
