import { describe, expect, it } from 'vitest';
import { getBasePath } from './base-path';

describe('GitHub Pages base path', () => {
  it('uses root locally unless GitHub Pages is enabled', () => {
    expect(getBasePath({})).toBe('/');
  });

  it('uses the repository path for GitHub Pages builds', () => {
    expect(getBasePath({ GITHUB_PAGES: 'true' })).toBe('/yamato-vikings-hub/');
  });
});
