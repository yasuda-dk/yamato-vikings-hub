import { expect, test } from '@playwright/test';

test('mobile shell renders and navigates without horizontal overflow', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Team Hub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('link', { name: /events/i }).click();
  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();

  await page.getByRole('link', { name: /fines/i }).click();
  await expect(page.getByRole('heading', { name: 'Fines' })).toBeVisible();

  await page.getByRole('link', { name: /members/i }).click();
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
