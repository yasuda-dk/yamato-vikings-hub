import { render, screen } from '@testing-library/react';
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
