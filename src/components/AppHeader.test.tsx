import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('pairs the uncropped team banner with the emblem on Home', () => {
    render(<MemoryRouter><AppHeader selectedMember={{ first_name: 'Takashi' }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Yamato Vikings' })).toBeInTheDocument();
    expect(screen.getByAltText(/teammates together/)).toHaveAttribute('width', '860');
    expect(screen.getByAltText(/teammates together/)).toHaveAttribute('height', '645');
    expect(screen.getByAltText('Yamato Vikings logo')).toBeInTheDocument();
    const brand = screen.getByTestId('home-banner-brand');
    expect(brand).toHaveClass('absolute', 'top-0');
    expect(within(brand).getByAltText('Yamato Vikings logo')).toBeInTheDocument();
    expect(within(brand).getByRole('heading', { name: 'Yamato Vikings' })).toHaveClass('text-white');
    expect(within(brand).getByText('Team Hub')).toHaveClass('text-white');
  });

  it('keeps other screens compact', () => {
    render(<MemoryRouter initialEntries={['/events']}><AppHeader selectedMember={{ first_name: 'Takashi' }} /></MemoryRouter>);
    expect(screen.queryByAltText(/teammates together/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team Hub' })).toBeInTheDocument();
  });

  it('does not request the team banner before profile selection', () => {
    render(<MemoryRouter><AppHeader selectedMember={null} /></MemoryRouter>);
    expect(screen.queryByAltText(/teammates together/)).not.toBeInTheDocument();
  });
});
