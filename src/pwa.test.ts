import manifestText from '../public/manifest.webmanifest?raw';
import { describe, expect, it } from 'vitest';

describe('PWA manifest', () => {
  it('contains installable app metadata', () => {
    const manifest = JSON.parse(manifestText) as {
      name: string;
      display: string;
      start_url: string;
      icons: Array<{ src: string; type: string }>;
    };

    expect(manifest.name).toBe('Yamato Vikings Hub');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.map((icon) => icon.src)).toEqual(['icons/yamato-vikings-192.png', 'icons/yamato-vikings-512.png']);
    expect(manifest.icons.every((icon) => icon.type === 'image/png')).toBe(true);
  });
});
