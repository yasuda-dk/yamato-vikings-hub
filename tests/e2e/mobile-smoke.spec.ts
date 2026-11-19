import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('mobile shell renders and navigates without horizontal overflow', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
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

for (const width of [320, 390, 430]) {
  test(`loads screens on demand at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
    const chunks: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') chunks.push(new URL(request.url()).pathname);
    });
    let releaseEvents: () => void = () => {};
    const heldChunk = new Promise<void>((resolve) => { releaseEvents = resolve; });
    await page.route('**/assets/EventsPage-*.js', async (route) => {
      await heldChunk;
      await route.continue();
    });
    await page.goto('./');
    await expect(page.getByLabel('Team password')).toBeVisible();
    await expect.poll(() => chunks.some((url) => /HomePage-/.test(url))).toBe(true);
    expect(chunks.some((url) => /(?:EventsPage|EventDetailPage|FinesPage|MembersPage)-/.test(url))).toBe(false);
    await page.getByLabel('Team password').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('First name').fill('Admin');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    const banner = page.getByAltText(/teammates together/);
    await expect(banner).toBeVisible();
    await expect.poll(() => banner.evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.getByAltText('Yamato Vikings logo')).toBeVisible();
    expect(await banner.evaluate((image) => getComputedStyle(image).objectFit)).toBe('contain');
    expect(await page.evaluate(async () => (await document.fonts.load('700 28px "Barlow Condensed"')).length)).toBe(1);
    const brand = page.getByTestId('home-banner-brand');
    await expect(brand.getByRole('heading')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(brand.getByText('Team Hub')).toHaveCSS('color', 'rgb(255, 255, 255)');
    const placement = await brand.evaluate((element) => {
      const overlay = element.getBoundingClientRect();
      const photo = element.parentElement!.querySelector('img')!.getBoundingClientRect();
      const title = element.querySelector('h1')!;
      return {
        withinPhoto: overlay.top >= photo.top && overlay.bottom <= photo.bottom && overlay.left >= photo.left && overlay.right <= photo.right,
        titleFits: title.scrollWidth <= title.clientWidth,
      };
    });
    expect(placement).toEqual({ withinPhoto: true, titleFits: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`home-banner-${width}.png`) });
    expect(chunks.some((url) => /HomePage-/.test(url))).toBe(true);
    expect(chunks.some((url) => /(?:EventsPage|EventDetailPage|FinesPage|MembersPage)-/.test(url))).toBe(false);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
    await page.getByRole('heading', { name: 'Season overview', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await page.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Opening screen' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    const loader = page.getByTestId('football-loader');
    await expect(loader).toBeVisible();
    await expect.poll(() => loader.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const positions = await loader.evaluate((element) => {
      const animations = element.getAnimations({ subtree: true });
      animations.forEach((animation) => { animation.pause(); animation.currentTime = 240; });
      const ball = element.querySelector('.football-loader__ball')!;
      const before = ball.getBoundingClientRect().x;
      animations.forEach((animation) => { animation.currentTime = 1008; });
      return { before, after: ball.getBoundingClientRect().x };
    });
    expect(positions.after).toBeGreaterThan(positions.before + 100);
    await page.screenshot({ path: testInfo.outputPath(`lazy-loading-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(loader.locator('img').first()).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    releaseEvents();
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
    expect(chunks.filter((url) => /EventsPage-/.test(url))).toHaveLength(1);
    await page.route('**/assets/FinesPage-*.js', (route) => route.abort());
    await page.getByRole('link', { name: 'Fines', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not open screen');
    await expect(page.getByRole('button', { name: 'Reload' })).toBeEnabled();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`lazy-error-${width}.png`) });
  });

  test(`event totals and pitch persist at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
    await page.goto('./');
    await page.getByLabel('Team password').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('First name').fill('Admin');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`home-first-${width}.png`) });
    await page.getByText('Practice payment history', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText('4 vs 4 · 400 kr', { exact: true })).toBeVisible();
    await expect(page.getByText(/Total cost: 400 kr/)).toBeVisible();
    await expect(page.getByText('-320 kr', { exact: true })).toHaveCount(2);
    await page.getByText('Practice payment history', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`practice-history-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('link', { name: /events/i }).click();
    await page.getByRole('link', { name: /Friday Football/i }).click();
    await expect(page.getByText('7 aside half indoor', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Going', exact: true }).click();
    await page.getByRole('button', { name: 'Update RSVP' }).click();
    await expect(page.getByText('RSVP updated.')).toBeVisible();
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest first name').fill('Mio');
    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(page.getByText('Guest added.')).toBeVisible();
    await expect(page.getByText('Expected', { exact: true }).locator('..')).toHaveText('3Expected');

    await page.getByRole('button', { name: 'Edit event' }).click();
    await expect(page.getByLabel('Pitch')).toHaveValue('7 aside half indoor');
    await page.getByLabel('Pitch').selectOption('4 vs 4');
    await page.getByLabel('Pitch').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`pitch-form-${width}.png`) });
    await page.getByRole('button', { name: 'Save event' }).click();
    await expect(page.getByText('Event updated.')).toBeVisible();
    await expect(page.getByText('4 vs 4 (400 kr)', { exact: true })).toBeVisible();
    await page.getByText('Pitch', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`event-detail-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    await page.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page.getByText('3 expected', { exact: true })).toBeVisible();
    await expect(page.getByText('2 guests', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`events-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('shows the loading photo before the app JavaScript arrives', async ({ page }, testInfo) => {
  await page.route('**/assets/index-*.js', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByText('Loading Yamato Vikings', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.startup-loader img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('startup-loading.png') });
  await page.unroute('**/assets/index-*.js');
  await page.reload();
  await expect(page.getByLabel('Team password')).toBeVisible();
});
