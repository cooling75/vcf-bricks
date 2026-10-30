import { describe, expect, it } from 'vitest';
import { getHints } from './hints';
import { addNode, connectNodes, createEmptyDocument, updateNode } from './model';

describe('nonbinding workshop hints', () => {
  it('provides German advisory text without changing the project', () => {
    const doc = createEmptyDocument();
    const before = JSON.stringify(doc);
    const hints = getHints(doc);
    expect(hints.length).toBeGreaterThan(0);
    expect(JSON.stringify(doc)).toBe(before);
    expect(hints.some(h => /Hinweise.*übersteuerbar/i.test(h.message))).toBe(true);
    for (const hint of hints) {
      expect(hint.message).toBeTruthy();
      expect(['info', 'warning']).toContain(hint.severity);
      expect(hint.nodeIds.every(id => doc.nodes.some(n => n.id === id))).toBe(true);
    }
    expect(new Set(hints.map(h => h.id)).size).toBe(hints.length);
  });
  it('distinguishes logical scope from hosting and does not promise hardware suitability', () => {
    const doc = addNode(addNode(createEmptyDocument(), 'fleet'), 'esx-host');
    const messages = getHints(doc).map(h => h.message).join(' ');
    expect(messages).toMatch(/logisch.*Hosting/i);
    expect(messages).toMatch(/keine Hardware-/i);
  });
  it('uses vSphere Kubernetes Service and distinguishes Supervisor from workloadclusters', () => {
    let doc = addNode(createEmptyDocument(), 'vks-cluster');
    let hints = getHints(doc);
    expect(hints.some(h => /vSphere Kubernetes Service/.test(h.message) && /Supervisor/.test(h.message) && /Workloadcluster/.test(h.message))).toBe(true);
    const missing = hints.find(h => h.id === 'vks-supervisor-scope');
    expect(missing?.message).toMatch(/außerhalb.*Scope|außerhalb.*Ausschnitt/i);
    doc = addNode(doc, 'supervisor');
    hints = getHints(doc);
    expect(hints.some(h => h.id === 'vks-supervisor-scope')).toBe(false);
  });
  it.each(['vcf-9.0', 'vcf-9.1'] as const)('does not impose edge or quantity requirements for %s', profile => {
    let doc = addNode(addNode(createEmptyDocument(), 'vcenter'), 'esx-host');
    doc = { ...doc, profile };
    const before = getHints(doc);
    doc = updateNode(doc, doc.nodes[1].id, { config: { version: '', instances: 7, notes: 'Eigene Workshop-Annahme' } });
    doc = connectNodes(doc, doc.nodes[0].id, doc.nodes[1].id, 'manages');
    expect(getHints(doc)).toEqual(before);
    expect(before.map(h => h.message).join(' ')).not.toMatch(/muss|zwingend|mindestens|Pflichtkante/i);
    expect(before.some(h => h.message.includes(profile === 'vcf-9.0' ? 'VCF 9.0' : 'VCF 9.1'))).toBe(true);
  });
  it('keeps hint IDs stable across label changes for optional dismissal in the UI', () => {
    const doc = addNode(createEmptyDocument(), 'vks-cluster');
    const next = updateNode(doc, doc.nodes[0].id, { label: 'Freie Benennung' });
    expect(getHints(next).map(h => h.id)).toEqual(getHints(doc).map(h => h.id));
  });
});
