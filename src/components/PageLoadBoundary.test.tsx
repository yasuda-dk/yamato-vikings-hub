import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PageLoadBoundary } from './PageLoadBoundary';

it('offers recovery when a screen cannot be loaded', () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenScreen(): never { throw new Error('Chunk unavailable'); }
  try {
    render(<PageLoadBoundary><BrokenScreen /></PageLoadBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not open screen');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled();
  } finally {
    errorLog.mockRestore();
  }
});
