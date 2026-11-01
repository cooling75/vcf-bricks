import type { ArchitectureDocument, ArchitectureHint } from '../contracts';

/** Discussion prompts, not a rules engine, compatibility check or deployment validator.
 * IDs remain stable so consumers may dismiss/override hints without editing the model.
 * Deliberately no host-count rules or compulsory version-specific relationships.
 */
export function getHints(doc: ArchitectureDocument): ArchitectureHint[] {
  const hints: ArchitectureHint[] = [{
    id: 'workshop-advisory', severity: 'info', nodeIds: [],
    message: 'All hints can be overridden: the diagram records workshop assumptions, not a validated reference architecture. Check the version, configuration and suitability for your specific scenario.',
  }];
  if (doc.nodes.length > 0) {
    hints.push({
      id: 'scope-not-hosting', severity: 'info', nodeIds: [],
      message: 'Colored boundaries show logical scopes, not necessarily physical hosting. Components and quantities do not guarantee hardware suitability, capacity or compatibility; relationships are freely modeled assumptions.',
    });
  }
  if (doc.profile !== 'unspecified') {
    const version = doc.profile === 'vcf-9.0' ? 'VCF 9.0' : 'VCF 9.1';
    hints.push({
      id: 'profile-context', severity: 'info', nodeIds: [],
      message: `Profile ${version}: Check product roles, supported versions and lifecycle responsibilities against the documentation for your environment. Selecting a profile does not confirm supportability or prescribe any relationship or quantity.`,
    });
  }
  const vks = doc.nodes.filter(node => node.kind === 'vks-cluster');
  const supervisors = doc.nodes.filter(node => node.kind === 'supervisor');
  if (vks.length > 0 || supervisors.length > 0) {
    hints.push({
      id: 'vks-supervisor-distinction', severity: 'info', nodeIds: [...supervisors, ...vks].map(node => node.id),
      message: 'vSphere Kubernetes Service (VKS) provides Kubernetes workload clusters. The Supervisor and VKS workload clusters operate at different layers; a vSphere Namespace defines a logical scope for resources and policies. This distinction is independent of freely chosen diagram relationships.',
    });
    if (vks.length > 0 && supervisors.length === 0) {
      hints.push({
        id: 'vks-supervisor-scope', severity: 'info', nodeIds: vks.map(node => node.id),
        message: 'A VKS workload cluster is shown, but no Supervisor. Consider whether the Supervisor is outside the selected scope or would be useful as another component for the discussion. This does not require a specific relationship.',
      });
    }
  }
  return hints;
}
