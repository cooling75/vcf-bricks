import type { ArchitectureDocument, ArchitectureHint } from '../contracts';

/** Discussion prompts, not a rules engine, compatibility check or deployment validator.
 * IDs remain stable so consumers may dismiss/override hints without editing the model.
 * Deliberately no host-count rules or compulsory version-specific relationships.
 */
export function getHints(doc: ArchitectureDocument): ArchitectureHint[] {
  const hints: ArchitectureHint[] = [{
    id: 'workshop-advisory', severity: 'info', nodeIds: [],
    message: 'Alle Hinweise sind übersteuerbar: Das Diagramm dokumentiert Workshop-Annahmen, keine geprüfte Referenzarchitektur. Version, Ausprägung und Eignung bitte für das konkrete Szenario prüfen.',
  }];
  if (doc.nodes.length > 0) {
    hints.push({
      id: 'scope-not-hosting', severity: 'info', nodeIds: [],
      message: 'Farbige Grenzen zeigen logische Bereiche, nicht automatisch physisches Hosting. Bausteine und Mengen liefern keine Hardware-, Kapazitäts- oder Kompatibilitätsgarantie; Beziehungen sind frei modellierbare Annahmen.',
    });
  }
  if (doc.profile !== 'unspecified') {
    const version = doc.profile === 'vcf-9.0' ? 'VCF 9.0' : 'VCF 9.1';
    hints.push({
      id: 'profile-context', severity: 'info', nodeIds: [],
      message: `Profil ${version}: Produktrollen, unterstützte Versionen und Lifecycle-Zuständigkeiten anhand der zur Umgebung passenden Dokumentation prüfen. Die Profilauswahl bestätigt keine Supportfähigkeit und schreibt keine Verbindung oder Anzahl vor.`,
    });
  }
  const vks = doc.nodes.filter(node => node.kind === 'vks-cluster');
  const supervisors = doc.nodes.filter(node => node.kind === 'supervisor');
  if (vks.length > 0 || supervisors.length > 0) {
    hints.push({
      id: 'vks-supervisor-distinction', severity: 'info', nodeIds: [...supervisors, ...vks].map(node => node.id),
      message: 'Der vSphere Kubernetes Service (VKS) stellt Kubernetes-Workloadcluster bereit. Supervisor und VKS-Workloadcluster sind unterschiedliche Ebenen; ein vSphere Namespace beschreibt einen logischen Ressourcen- und Richtlinienbereich. Diese Unterscheidung ist unabhängig von frei gewählten Diagrammkanten.',
    });
    if (vks.length > 0 && supervisors.length === 0) {
      hints.push({
        id: 'vks-supervisor-scope', severity: 'info', nodeIds: vks.map(node => node.id),
        message: 'Ein VKS-Workloadcluster ist dargestellt, ein Supervisor nicht. Prüfen, ob der Supervisor außerhalb des gewählten Scopes liegt oder als weiterer Baustein für das Gespräch hilfreich wäre. Daraus folgt keine Pflichtkante.',
      });
    }
  }
  return hints;
}
