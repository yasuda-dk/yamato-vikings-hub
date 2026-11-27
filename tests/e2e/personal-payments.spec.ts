import { expect, test } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

for (const width of [320, 390, 430]) {
  test(`personal all-time unpaid Practices at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
    await page.goto('./');
    await page.getByLabel('Team password').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('First name').fill('Admin');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your unpaid Practices' })).toHaveCount(0);
    const practiceUrls: string[] = [];
    for (const date of ['2024-09-10', '2026-09-17']) {
      await page.getByRole('link', { name: 'Events', exact: true }).click();
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByLabel('Title', { exact: true }).fill('Practice');
      await page.getByLabel('Date', { exact: true }).fill(date);
      await page.getByLabel('Location', { exact: true }).fill('Indoor pitch');
      await page.getByLabel('RSVP deadline').fill(`${date}T12:00`);
      await page.getByRole('button', { name: 'Create event', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your RSVP' })).toBeVisible();
      practiceUrls.push(page.url());
    }
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Switch profile' }).click();
    await page.getByRole('button', { name: /new/ }).click();
    await page.getByLabel('First name').fill('Mio');
    await page.getByRole('button', { name: 'Create profile' }).click();
    for (const url of practiceUrls) {
      await page.goto(url);
      await page.getByRole('button', { name: 'Going', exact: true }).click();
      await page.getByRole('button', { name: 'Update RSVP' }).click();
      await expect(page.getByText('RSVP updated.')).toBeVisible();
    }
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    const unpaid = page.getByRole('region', { name: 'Your unpaid Practices' });
    await page.getByTestId('personal-unpaid').scrollIntoViewIfNeeded();
    await expect(unpaid.getByText(/2 unpaid/)).toBeVisible();
    await expect(unpaid.getByRole('button', { name: /Mark 10 Sept? 2024 as paid/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`personal-unpaid-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await unpaid.getByRole('button', { name: /Mark 10 Sept? 2024 as paid/ }).click();
    await expect(unpaid.getByText(/1 unpaid/)).toBeVisible();
    await expect(unpaid.getByText(/10 Sept? 2024 marked as paid\./)).toBeVisible();
    await unpaid.getByRole('button', { name: /Mark 17 Sept? 2026 as paid/ }).click();
    await expect(unpaid.getByText('No unpaid past Practices.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`personal-paid-${width}.png`), fullPage: true });
    await expect(page.getByText('Payment tracking', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Practice payment history', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Switch profile' }).click();
    await page.getByRole('button', { name: /new/ }).click();
    await page.getByLabel('First name').fill('Other');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await page.getByTestId('personal-unpaid').scrollIntoViewIfNeeded();
    await expect(page.getByRole('region', { name: 'Your unpaid Practices' }).getByText('No unpaid past Practices.')).toBeVisible();
    await expect(page.getByText(/17 Sept? 2026 marked as paid\./)).toHaveCount(0);
  });
}
