import { expect, test } from '@playwright/test';

test('mobile shell renders and navigates without horizontal overflow', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Team Hub', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Enter team password' })).toBeVisible();

  await page.getByLabel('Team password').fill('demo');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Choose profile' })).toBeVisible();
  await page.getByLabel('First name').fill('Takashi');
  await page.getByRole('button', { name: 'Create profile' }).click();

  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('link', { name: /events/i }).click();
  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  await page.getByRole('link', { name: /Friday Football/i }).click();
  await expect(page.getByRole('heading', { name: 'Your RSVP' })).toBeVisible();
  await page.getByLabel('I’ll be late').check();
  await page.getByLabel('Expected arrival time').fill('19:30');
  await page.getByRole('button', { name: 'Update RSVP' }).click();
  await expect(page.getByText('RSVP updated.')).toBeVisible();

  await page.getByRole('link', { name: /fines/i }).click();
  await expect(page.getByRole('heading', { name: 'Fines' })).toBeVisible();

  await page.getByRole('link', { name: /members/i }).click();
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
