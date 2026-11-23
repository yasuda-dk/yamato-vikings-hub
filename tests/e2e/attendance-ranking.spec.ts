import { expect, test } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

for (const width of [320, 390, 430]) {
  test(`Takashi attendance ranking is private and uses Going at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-10-08T21:00:00Z'));
    const chunks: string[] = [];
    page.on('request', (request) => { if (request.resourceType() === 'script') chunks.push(request.url()); });
    await page.goto('./');
    await page.getByLabel('Team password').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('First name').fill('Takashi');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('link', { name: 'Attendance Top 10' })).toBeVisible();
    expect(chunks.some((url) => url.includes('AttendanceRankingPage-'))).toBe(false);
    await page.getByRole('link', { name: 'Attendance Top 10' }).click();
    await expect(page.getByText('No Going RSVPs in this period.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ranking-empty-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Events', exact: true }).click();
    await page.getByRole('link', { name: /Friday Football/ }).click();
    await page.getByRole('button', { name: 'Update RSVP' }).click();
    await expect(page.getByText('RSVP updated.')).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.getByRole('link', { name: 'Attendance Top 10' }).click();
    await expect(page.getByRole('rowheader', { name: 'Takashi' })).toBeVisible();
    await expect(page.getByRole('row', { name: '1 Takashi 1' })).toBeVisible();
    await expect(page.getByText("Going RSVPs · Past and today's events")).toBeVisible();
    await page.getByLabel('Period').selectOption('all');
    await expect(page.getByRole('rowheader', { name: 'Takashi' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`ranking-populated-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await page.getByRole('button', { name: 'Switch profile' }).click();
    await page.getByRole('button', { name: /new/ }).click();
    await page.getByLabel('First name').fill('Admin');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Attendance Top 10' })).toHaveCount(0);
    await page.goto('./#/attendance-ranking');
    await expect(page.getByRole('alert')).toHaveText(/Only Takashi/);
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`ranking-denied-${width}.png`), fullPage: true });
  });
}
