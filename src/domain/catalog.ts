import type { CatalogItem, Category, ComponentKind } from '../contracts';

export const CATEGORY_LABELS: Record<Category, string> = {
  boundaries: 'Logical Scopes', management: 'Management', network: 'Network',
  compute: 'Compute & Storage', kubernetes: 'Kubernetes',
};

/** Workshop symbols, not hardware specifications or deployment requirements. */
export const CATALOG: CatalogItem[] = [
  { kind: 'fleet', label: 'VCF Fleet', shortLabel: 'Fleet', category: 'boundaries', color: '#8b5cf6', isBoundary: true, description: 'Logical scope for VCF instances; does not imply physical hosting.' },
  { kind: 'instance', label: 'VCF Instance', shortLabel: 'Instance', category: 'boundaries', color: '#3b82f6', isBoundary: true, description: 'Logical scope for a VMware Cloud Foundation instance.' },
  { kind: 'management-domain', label: 'Management Domain', shortLabel: 'Mgmt Domain', category: 'boundaries', color: '#0d9488', isBoundary: true, description: 'Logical management scope; placement does not imply hosting.' },
  { kind: 'workload-domain', label: 'Workload Domain', shortLabel: 'Workload', category: 'boundaries', color: '#d97706', isBoundary: true, description: 'Logical scope for workloads within a VCF instance.' },
  { kind: 'vsphere-cluster', label: 'vSphere Cluster', shortLabel: 'Cluster', category: 'boundaries', color: '#64748b', isBoundary: true, description: 'Logical grouping of a vSphere cluster, with no fixed host count.' },
  { kind: 'vcenter', label: 'vCenter Server', shortLabel: 'vCenter', category: 'management', color: '#2563eb', isBoundary: false, description: 'Manages vSphere resources; relationships can be modeled freely in the workshop.' },
  { kind: 'nsx-manager', label: 'NSX Manager', shortLabel: 'NSX Mgr', category: 'network', color: '#0891b2', isBoundary: false, description: 'NSX management component. The instance count is a workshop assumption.' },
  { kind: 'nsx-edge', label: 'NSX Edge', shortLabel: 'NSX Edge', category: 'network', color: '#0891b2', isBoundary: false, description: 'Symbol for NSX network services, with no prescribed topology.' },
  { kind: 'esx-host', label: 'ESX Host', shortLabel: 'ESX', category: 'compute', color: '#475569', isBoundary: false, description: 'Abstract host symbol, not a hardware or compatibility guarantee.' },
  { kind: 'vsan', label: 'vSAN', shortLabel: 'vSAN', category: 'compute', color: '#16a34a', isBoundary: false, description: 'Logical vSAN storage component; does not guarantee capacity or hardware suitability.' },
  { kind: 'external-storage', label: 'External Storage', shortLabel: 'Storage', category: 'compute', color: '#16a34a', isBoundary: false, description: 'Externally provided storage; assess suitability and connectivity separately.' },
  { kind: 'supervisor', label: 'Supervisor', shortLabel: 'Supervisor', category: 'kubernetes', color: '#7c3aed', isBoundary: false, description: 'vSphere Kubernetes control plane; distinct from a VKS workload cluster.' },
  { kind: 'vsphere-namespace', label: 'vSphere Namespace', shortLabel: 'Namespace', category: 'kubernetes', color: '#7c3aed', isBoundary: false, description: 'Logical vSphere namespace for resources and policies.' },
  { kind: 'vks-cluster', label: 'vSphere Kubernetes Service – Cluster', shortLabel: 'VKS Cluster', category: 'kubernetes', color: '#9333ea', isBoundary: false, description: 'Kubernetes workload cluster provided by vSphere Kubernetes Service (VKS), separate from the Supervisor.' },
  { kind: 'vcf-operations', label: 'VCF Operations', shortLabel: 'Operations', category: 'management', color: '#2563eb', isBoundary: false, description: 'Operations component for the selected logical VCF scope.' },
  { kind: 'vcf-automation', label: 'VCF Automation', shortLabel: 'Automation', category: 'management', color: '#2563eb', isBoundary: false, description: 'Automation component; the required configuration depends on the scenario.' },
  { kind: 'sddc-manager', label: 'SDDC Manager', shortLabel: 'SDDC Mgr', category: 'management', color: '#2563eb', isBoundary: false, description: 'Management component; check its role and lifecycle relationships for the relevant version.' },
  { kind: 'network', label: 'Network', shortLabel: 'Network', category: 'network', color: '#0891b2', isBoundary: false, description: 'Abstract network symbol for connections and scopes with custom labels.' },
];

export function getCatalogItem(kind: ComponentKind): CatalogItem {
  const item = CATALOG.find(entry => entry.kind === kind);
  if (!item) throw new Error('Unknown component kind.');
  return item;
}
