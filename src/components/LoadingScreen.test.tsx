import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingScreen } from './LoadingScreen';

describe('LoadingScreen', () => {
  it('shows a decorative football animation with an accessible loading status', () => {
    const { container } = render(<LoadingScreen />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { name: 'Opening Team Hub' })).toBeInTheDocument();
    expect(screen.getByTestId('football-loader')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the current screen loading label', () => {
    render(<LoadingScreen title="Opening screen" />);
    expect(screen.getByRole('heading', { name: 'Opening screen' })).toBeInTheDocument();
  });
});
