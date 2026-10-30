import type { ArchitectureDocument, ArchitectureNode, ComponentKind, RelationKind } from '../contracts';
import { getCatalogItem } from './catalog';

type Example = { id: string; name: string; description: string; document: ArchitectureDocument };

/** Entirely invented workshop data, intentionally not an official validated design. */
function buildExample(id: string, title: string, profile: ArchitectureDocument['profile']) {
  const document: ArchitectureDocument = { schemaVersion: 1, id, title, profile, mode: 'sandbox', nodes: [], edges: [] };
  function node(localId: string, kind: ComponentKind, x: number, y: number, parent?: string, label?: string, width?: number, height?: number): string {
    const key = `${id}-${localId}`;
    const value: ArchitectureNode = { id: key, kind, label: label ?? getCatalogItem(kind).label, position: { x, y },
      config: { version: '', instances: 1, notes: 'Fiktiver Workshop-Baustein. Logischer Scope, keine Hosting-, Hardware- oder Dimensionierungszusage.' },
      ...(parent ? { parentId: parent } : {}), ...(width && height ? { size: { width, height } } : {}) };
    document.nodes.push(value);
    return key;
  }
  function edge(source: string, target: string, kind: RelationKind) {
    document.edges.push({ id: `${id}-edge-${document.edges.length + 1}`, source, target, kind });
  }
  return { document, node, edge };
}

function genericVCF(): Example {
  const b = buildExample('example-vcf', 'Fiktives Beispiel: VCF – Management & Workloads', 'vcf-9.0');
  const fleet = b.node('fleet', 'fleet', 40, 40, undefined, 'Beispiel-Fleet', 1580, 1080);
  const instance = b.node('instance', 'instance', 40, 80, fleet, 'VCF-Instanz · Workshop', 1500, 940);
  const mgmt = b.node('mgmt', 'management-domain', 32, 80, instance, 'Management Domain · logischer Scope', 700, 740);
  const workload = b.node('workload', 'workload-domain', 770, 80, instance, 'Workload Domain · Anwendungen', 700, 740);
  const vcMgmt = b.node('mgmt-vcenter', 'vcenter', 24, 76, mgmt);
  b.node('sddc', 'sddc-manager', 244, 76, mgmt);
  const nsxMgmt = b.node('mgmt-nsx', 'nsx-manager', 464, 76, mgmt);
  b.node('operations', 'vcf-operations', 24, 174, mgmt);
  b.node('automation', 'vcf-automation', 244, 174, mgmt);
  const mgmtCluster = b.node('mgmt-cluster', 'vsphere-cluster', 24, 290, mgmt, 'vSphere Cluster · Management', 652, 420);
  const mgmtHost = b.node('mgmt-host', 'esx-host', 24, 90, mgmtCluster, 'ESX · Beispielressource');
  const mgmtStorage = b.node('mgmt-vsan', 'vsan', 244, 90, mgmtCluster);
  const mgmtNetwork = b.node('mgmt-network', 'network', 24, 220, mgmtCluster, 'Management-Netz');
  const vcWorkload = b.node('workload-vcenter', 'vcenter', 24, 80, workload);
  const nsxWorkload = b.node('workload-nsx', 'nsx-manager', 244, 80, workload);
  const edgeWorkload = b.node('workload-edge', 'nsx-edge', 464, 80, workload);
  const cluster = b.node('workload-cluster', 'vsphere-cluster', 24, 240, workload, 'vSphere Cluster · Anwendungen', 652, 450);
  const host = b.node('workload-host', 'esx-host', 24, 100, cluster, 'ESX · Beispielressource');
  const storage = b.node('workload-vsan', 'vsan', 244, 100, cluster);
  const network = b.node('workload-network', 'network', 24, 240, cluster, 'Workload-Netz');
  b.node('external-storage', 'external-storage', 244, 240, cluster, 'Option: externer Storage');
  b.edge(vcMgmt, mgmtCluster, 'manages');
  b.edge(mgmtHost, mgmtStorage, 'uses-storage');
  b.edge(nsxMgmt, mgmtNetwork, 'manages');
  b.edge(vcWorkload, cluster, 'manages');
  b.edge(host, storage, 'uses-storage');
  b.edge(host, network, 'uses-network');
  b.edge(nsxWorkload, edgeWorkload, 'manages');
  b.edge(edgeWorkload, network, 'connects');
  return { id: 'vcf-overview', name: 'VCF · Management & Workloads', description: 'Fiktives Workshop-Beispiel mit farbigen logischen Bereichen; keine offizielle Vorlage und keine validierte Referenzarchitektur. Kanten und Anzahl sind frei veränderbare Annahmen.', document: b.document };
}

function vks(): Example {
  const b = buildExample('example-vks', 'Fiktives Beispiel: vSphere Kubernetes Service', 'vcf-9.1');
  const fleet = b.node('fleet', 'fleet', 40, 40, undefined, 'Beispiel-Fleet · Kubernetes', 1700, 1280);
  const instance = b.node('instance', 'instance', 40, 80, fleet, 'VCF-Instanz · Workshop', 1620, 1140);
  const mgmt = b.node('mgmt', 'management-domain', 32, 90, instance, 'Management Domain', 480, 970);
  const workload = b.node('workload', 'workload-domain', 544, 90, instance, 'Workload Domain · VKS', 1040, 970);
  b.node('mgmt-vcenter', 'vcenter', 24, 90, mgmt);
  b.node('sddc', 'sddc-manager', 244, 90, mgmt);
  b.node('operations', 'vcf-operations', 24, 210, mgmt);
  b.node('automation', 'vcf-automation', 244, 210, mgmt);
  b.node('mgmt-nsx', 'nsx-manager', 24, 330, mgmt);
  const mgmtCluster = b.node('mgmt-cluster', 'vsphere-cluster', 24, 480, mgmt, 'vSphere Cluster · Management', 432, 430);
  b.node('mgmt-host', 'esx-host', 24, 90, mgmtCluster);
  b.node('mgmt-vsan', 'vsan', 244, 90, mgmtCluster);
  b.node('mgmt-network', 'network', 24, 220, mgmtCluster);
  const vc = b.node('workload-vcenter', 'vcenter', 24, 90, workload);
  const nsx = b.node('workload-nsx', 'nsx-manager', 244, 90, workload);
  const edge = b.node('workload-edge', 'nsx-edge', 464, 90, workload);
  const cluster = b.node('workload-cluster', 'vsphere-cluster', 24, 250, workload, 'vSphere Cluster · Supervisor & Workloads', 992, 640);
  const host = b.node('workload-host', 'esx-host', 24, 90, cluster, 'ESX · Beispielressource');
  const storage = b.node('workload-vsan', 'vsan', 244, 90, cluster);
  const supervisor = b.node('supervisor', 'supervisor', 24, 250, cluster, 'Supervisor · Steuerungsebene');
  const namespace = b.node('namespace', 'vsphere-namespace', 264, 250, cluster, 'vSphere Namespace · Team A');
  const vksCluster = b.node('vks', 'vks-cluster', 504, 250, cluster, 'VKS · Kubernetes-Workloadcluster');
  const network = b.node('network', 'network', 24, 430, cluster, 'Workload-Netz · Beispiel');
  b.edge(vc, cluster, 'manages');
  b.edge(nsx, edge, 'manages');
  b.edge(edge, network, 'connects');
  b.edge(host, storage, 'uses-storage');
  b.edge(supervisor, namespace, 'manages');
  b.edge(namespace, vksCluster, 'contains');
  b.edge(vksCluster, cluster, 'runs-on');
  b.edge(vksCluster, network, 'uses-network');
  return { id: 'vks-workshop', name: 'VKS · Supervisor & Workloadcluster', description: 'Synthetisches Beispiel für den vSphere Kubernetes Service: Supervisor und Kubernetes-Workloadcluster sind getrennte Bausteine. Keine offizielle Vorlage, keine feste Anzahl und keine vorgeschriebenen Kanten.', document: b.document };
}

export const EXAMPLES: Array<{ id: string; name: string; description: string; document: ArchitectureDocument }> = [genericVCF(), vks()];
