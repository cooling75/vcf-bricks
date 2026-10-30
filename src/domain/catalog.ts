import type { CatalogItem, Category, ComponentKind } from '../contracts';

export const CATEGORY_LABELS: Record<Category, string> = {
  boundaries: 'Logische Bereiche', management: 'Management', network: 'Netzwerk',
  compute: 'Compute & Storage', kubernetes: 'Kubernetes',
};

/** Workshop symbols, not hardware specifications or deployment requirements. */
export const CATALOG: CatalogItem[] = [
  { kind: 'fleet', label: 'VCF Fleet', shortLabel: 'Fleet', category: 'boundaries', color: '#8b5cf6', isBoundary: true, description: 'Logischer Bereich für VCF-Instanzen; keine Aussage über physisches Hosting.' },
  { kind: 'instance', label: 'VCF-Instanz', shortLabel: 'Instanz', category: 'boundaries', color: '#3b82f6', isBoundary: true, description: 'Logischer Bereich einer VMware Cloud Foundation Instanz.' },
  { kind: 'management-domain', label: 'Management Domain', shortLabel: 'Mgmt Domain', category: 'boundaries', color: '#0d9488', isBoundary: true, description: 'Logischer Management-Bereich; Platzierung ist keine Hosting-Zusage.' },
  { kind: 'workload-domain', label: 'Workload Domain', shortLabel: 'Workload', category: 'boundaries', color: '#d97706', isBoundary: true, description: 'Logischer Bereich für Workloads innerhalb einer VCF-Instanz.' },
  { kind: 'vsphere-cluster', label: 'vSphere Cluster', shortLabel: 'Cluster', category: 'boundaries', color: '#64748b', isBoundary: true, description: 'Logische Gruppierung eines vSphere Clusters, ohne feste Hostanzahl.' },
  { kind: 'vcenter', label: 'vCenter Server', shortLabel: 'vCenter', category: 'management', color: '#2563eb', isBoundary: false, description: 'Verwaltung von vSphere-Ressourcen; Beziehungen im Workshop frei modellierbar.' },
  { kind: 'nsx-manager', label: 'NSX Manager', shortLabel: 'NSX Mgr', category: 'network', color: '#0891b2', isBoundary: false, description: 'Management-Komponente für NSX. Anzahl ist eine Workshop-Annahme.' },
  { kind: 'nsx-edge', label: 'NSX Edge', shortLabel: 'NSX Edge', category: 'network', color: '#0891b2', isBoundary: false, description: 'Symbol für NSX-Netzwerkdienste, ohne festgelegte Topologie.' },
  { kind: 'esx-host', label: 'ESX Host', shortLabel: 'ESX', category: 'compute', color: '#475569', isBoundary: false, description: 'Abstraktes Host-Symbol, keine Hardware- oder Kompatibilitätsgarantie.' },
  { kind: 'vsan', label: 'vSAN', shortLabel: 'vSAN', category: 'compute', color: '#16a34a', isBoundary: false, description: 'Logischer vSAN-Storagebaustein; keine Kapazitäts- oder Hardwarezusage.' },
  { kind: 'external-storage', label: 'Externer Storage', shortLabel: 'Storage', category: 'compute', color: '#16a34a', isBoundary: false, description: 'Extern bereitgestellter Storage; Eignung und Anbindung separat prüfen.' },
  { kind: 'supervisor', label: 'Supervisor', shortLabel: 'Supervisor', category: 'kubernetes', color: '#7c3aed', isBoundary: false, description: 'vSphere-Kubernetes-Steuerungsebene; nicht mit einem VKS-Workloadcluster gleichzusetzen.' },
  { kind: 'vsphere-namespace', label: 'vSphere Namespace', shortLabel: 'Namespace', category: 'kubernetes', color: '#7c3aed', isBoundary: false, description: 'Logischer vSphere-Namespace für Ressourcen und Richtlinien.' },
  { kind: 'vks-cluster', label: 'vSphere Kubernetes Service – Cluster', shortLabel: 'VKS Cluster', category: 'kubernetes', color: '#9333ea', isBoundary: false, description: 'Kubernetes-Workloadcluster des vSphere Kubernetes Service (VKS), getrennt vom Supervisor.' },
  { kind: 'vcf-operations', label: 'VCF Operations', shortLabel: 'Operations', category: 'management', color: '#2563eb', isBoundary: false, description: 'Operations-Baustein für den gewählten logischen VCF-Scope.' },
  { kind: 'vcf-automation', label: 'VCF Automation', shortLabel: 'Automation', category: 'management', color: '#2563eb', isBoundary: false, description: 'Automatisierungs-Baustein; die benötigte Ausprägung hängt vom Szenario ab.' },
  { kind: 'sddc-manager', label: 'SDDC Manager', shortLabel: 'SDDC Mgr', category: 'management', color: '#2563eb', isBoundary: false, description: 'Management-Baustein; Rolle und Lifecycle-Beziehungen versionsbezogen prüfen.' },
  { kind: 'network', label: 'Netzwerk', shortLabel: 'Netzwerk', category: 'network', color: '#0891b2', isBoundary: false, description: 'Abstraktes Netzwerksymbol für frei beschriftbare Verbindungen und Bereiche.' },
];

export function getCatalogItem(kind: ComponentKind): CatalogItem {
  const item = CATALOG.find(entry => entry.kind === kind);
  if (!item) throw new Error('Unbekannter Bausteintyp.');
  return item;
}
