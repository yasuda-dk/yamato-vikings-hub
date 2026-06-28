import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('renders the home route', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Team Hub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('loads all primary routes from bottom navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: /events/i }));
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /fines/i }));
    expect(screen.getByRole('heading', { name: 'Fines' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /members/i }));
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /home/i }));
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('falls back for invalid routes', () => {
    window.location.hash = '#/missing';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });

  it('fits a 320px mobile viewport without horizontal overflow', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    render(<App />);

    expect(screen.getByTestId('app-main')).toBeInTheDocument();
    expect(document.body.scrollWidth).toBeLessThanOrEqual(320);
  });
});
