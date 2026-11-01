import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'New draft', exact: true }).click();
});

test('explicit insertion target, nested tree and visible safe reassignment', async ({ page }) => {
  const target = page.getByRole('combobox', { name: 'Insert into', exact: true });
  await expect(target).toHaveValue('');
  await page.getByRole('button', { name: 'Add VCF Fleet', exact: true }).click();
  await page.getByLabel('Component name', { exact: true }).fill('Fleet A');
  await expect(target.locator('option:checked')).toHaveText(/Fleet A/);
  await page.getByRole('button', { name: 'Add VCF Instance', exact: true }).click();
  await page.getByLabel('Component name', { exact: true }).fill('Instanz A');
  await expect(target.locator('option:checked')).toHaveText(/Fleet A.*Instanz A/);
  await page.getByRole('button', { name: 'Add vCenter Server', exact: true }).click();
  await page.getByLabel('Component name', { exact: true }).fill('VC A');
  await expect(page.getByRole('combobox', { name: 'Parent frame', exact: true }).locator('option:checked')).toHaveText(/Instanz A/);
  await expect(page.locator('.react-flow__node.selected')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Add connection', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse Fleet A', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select VC A', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Expand Fleet A', exact: true }).click();
  await page.getByRole('button', { name: 'Select VC A', exact: true }).click();
  await page.getByRole('combobox', { name: 'Parent frame', exact: true }).selectOption({ label: 'Fleet A' });
  await expect.poll(() => page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!);
    return doc?.nodes.find((node: { label: string }) => node.label === 'VC A')?.parentId;
  })).toBe(await target.inputValue());
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Select VC A', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Parent frame', exact: true }).locator('option:checked')).toHaveText(/Instanz A/);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Select VC A', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Parent frame', exact: true }).locator('option:checked')).toHaveText('Fleet A');
});

test('imported frames without a saved size remain visible drop targets', async ({ page }) => {
  const draft = { schemaVersion: 1, id: 'sizeless', title: 'Importierter Rahmen', profile: 'unspecified', mode: 'sandbox', nodes: [
    { id: 'frame', kind: 'fleet', label: 'Ohne Größenangabe', position: { x: 0, y: 0 }, config: { version: '', instances: 1, notes: '' } },
  ], edges: [] };
  await page.locator('input[type=file]').setInputFiles({ name: 'sizeless.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft)) });
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(draft.title);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.waitForTimeout(350);
  const frame = page.locator('.react-flow__node[data-id=frame]');
  await expect(frame).toHaveCSS('width', '600px');
  const box = (await frame.boundingBox())!;
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.getByRole('button', { name: 'Add vCenter Server', exact: true }).dispatchEvent('dragstart', { dataTransfer });
  const position = { dataTransfer, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  const canvas = page.locator('section.vcf-canvas');
  await canvas.dispatchEvent('dragover', position);
  await expect(page.locator('[data-drop-target=frame]')).toBeVisible();
  await canvas.dispatchEvent('drop', position);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes.find((n: { kind: string }) => n.kind === 'vcenter')?.parentId)).toBe('frame');
});

test('catalog drops choose the deepest frame, free canvas stays unassigned, and mouse moves are atomic', async ({ page }) => {
  const config = { version: '', instances: 1, notes: '' };
  const draft = { schemaVersion: 1, id: 'placement-fixture', title: 'Zuordnung testen', profile: 'unspecified', mode: 'sandbox', nodes: [
    { id: 'a', kind: 'workload-domain', label: 'Bereich A', position: { x: 0, y: 0 }, size: { width: 350, height: 420 }, config },
    { id: 'b', kind: 'workload-domain', label: 'Bereich B', position: { x: 440, y: 0 }, size: { width: 500, height: 420 }, config },
    { id: 'inner', kind: 'vsphere-cluster', label: 'Innerer Rahmen', parentId: 'b', position: { x: 24, y: 64 }, size: { width: 420, height: 300 }, config },
    { id: 'vc', kind: 'vcenter', label: 'Vorhandener VC', parentId: 'a', position: { x: 48, y: 100 }, config },
    { id: 'outside', kind: 'network', label: 'Bestand', position: { x: 0, y: 480 }, config },
  ], edges: [{ id: 'retained-edge', source: 'vc', target: 'outside', kind: 'connects' }] };
  await page.locator('input[type=file]').setInputFiles({ name: 'placement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft)) });
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(draft.title);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.waitForTimeout(350);
  const canvas = page.locator('section.vcf-canvas');
  const target = page.locator('.react-flow__node[data-id=inner]');
  const box = (await target.boundingBox())!;
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.getByRole('button', { name: 'Add NSX Manager', exact: true }).dispatchEvent('dragstart', { dataTransfer });
  await canvas.dispatchEvent('dragover', { dataTransfer, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  await expect(page.locator('[data-drop-target=inner]')).toBeVisible();
  await canvas.dispatchEvent('drop', { dataTransfer, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  await page.getByRole('button', { name: 'Add NSX Manager', exact: true }).dispatchEvent('dragend', { dataTransfer });
  await expect.poll(() => page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!);
    return doc.nodes.find((node: { kind: string }) => node.kind === 'nsx-manager')?.parentId;
  })).toBe('inner');
  // A free-canvas drop must not inherit the selected frame's insertion target.
  const canvasBox = (await canvas.boundingBox())!;
  await page.getByRole('button', { name: 'Add vSAN', exact: true }).dispatchEvent('dragstart', { dataTransfer });
  const free = { dataTransfer, clientX: canvasBox.x + canvasBox.width - 55, clientY: canvasBox.y + canvasBox.height - 80 };
  await canvas.dispatchEvent('dragover', free);
  await expect(page.locator('[data-drop-target]')).toHaveCount(0);
  await canvas.dispatchEvent('drop', free);
  await page.getByRole('button', { name: 'Add vSAN', exact: true }).dispatchEvent('dragend', { dataTransfer });
  await expect.poll(() => page.evaluate(() => {
    const node = JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes.find((n: { kind: string }) => n.kind === 'vsan');
    return node ? node.parentId ?? 'root' : 'missing';
  })).toBe('root');
  const component = page.locator('.react-flow__node[data-id=vc]');
  const from = (await component.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width * 0.72, to.y + to.height * 0.72, { steps: 20 });
  await expect(page.locator('[data-drop-target=inner]')).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes.find((n: { id: string }) => n.id === 'vc').parentId)).toBe('inner');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).edges[0].id)).toBe('retained-edge');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes.find((n: { id: string }) => n.id === 'vc').parentId)).toBe('a');
  await page.reload();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(draft.title);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/vcf-placement-preview.png', fullPage: true });
});
