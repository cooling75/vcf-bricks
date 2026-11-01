import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';

test('catalog labels stay inside their badges and cards at desktop and mobile widths', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.catalog-item')).toHaveCount(18);
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflows = await page.locator('.catalog-item').evaluateAll(items => items.flatMap(item => {
      const card = item.getBoundingClientRect();
      return ['.catalog-icon', '.catalog-text strong'].flatMap(selector => {
        const element = item.querySelector<HTMLElement>(selector)!;
        const box = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = Array.from(range.getClientRects());
        const overflow = element.scrollWidth > element.clientWidth + 1 || rects.some(rect => rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1) || box.right > card.right + 1;
        const add = item.querySelector('.catalog-add')!.getBoundingClientRect();
        const overlap = selector === '.catalog-text strong' && box.right > add.left + 1;
        return overflow || overlap ? [{ label: item.getAttribute('aria-label'), selector, overflow, overlap }] : [];
      });
    }));
    expect(overflows, `Catalog overflow at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390) {
      await page.locator('.palette-panel').screenshot({ path: `test-results/catalog-${width}.png` });
    }
    await page.locator('.catalog-item').last().scrollIntoViewIfNeeded();
    await expect(page.locator('.catalog-item').last()).toBeInViewport();
    await page.locator('.palette-scroll').evaluate(element => { element.scrollTop = 0; });
  }
});

test('English controls preserve an existing German draft through reload and export', async ({ page }) => {
  const draft = { schemaVersion: 1, id: 'legacy-de', title: 'Meine Architektur – unverändert', profile: 'unspecified', mode: 'sandbox', nodes: [
    { id: 'legacy-node', kind: 'vcenter', label: 'Verwaltung für München', position: { x: 0, y: 0 }, config: { version: '9.0', instances: 1, notes: 'Kundennotiz: später prüfen.' } },
  ], edges: [] };
  await page.goto('./');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft)) });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Components', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(draft.title);
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await page.getByRole('button', { name: `Select ${draft.nodes[0].label}`, exact: true }).click();
  await expect(page.getByLabel('Component name', { exact: true })).toHaveValue(draft.nodes[0].label);
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue(draft.nodes[0].config.notes);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(draft);
});
