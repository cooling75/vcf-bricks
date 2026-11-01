import { test, expect } from '@playwright/test';

test('production assets, mouse drag, zoom, both examples and mobile layout', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto('./');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'New draft', exact: true }).click();
  await page.getByRole('button', { name: 'Add vCenter Server', exact: true }).click();
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  const brick = page.locator('.vcf-canvas__brick');
  await expect(brick).toBeVisible();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes[0].position);
  await page.waitForTimeout(300);
  const box = await brick.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 50, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!).nodes[0].position.x)).not.toBe(before.x);
  const viewport = page.locator('.react-flow__viewport');
  const previousTransform = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(viewport).not.toHaveAttribute('style', previousTransform!);
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'Examples', exact: true }).click();
    await page.getByRole('button', { name: /^Load example:/ }).nth(index).click();
    await page.getByRole('button', { name: 'Fit all', exact: true }).click();
    await expect(page.locator('.vcf-canvas__boundary').first()).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/vcf-bricks-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/vcf-bricks-mobile.png', fullPage: true });
  expect(problems).toEqual([]);
});
