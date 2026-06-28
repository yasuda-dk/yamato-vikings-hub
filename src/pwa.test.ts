import manifestText from '../public/manifest.webmanifest?raw';
import { describe, expect, it } from 'vitest';

describe('PWA manifest', () => {
  it('contains installable app metadata', () => {
    const manifest = JSON.parse(manifestText) as {
      name: string;
      display: string;
      start_url: string;
      icons: unknown[];
    };

    expect(manifest.name).toBe('Yamato Vikings Hub');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });
});
