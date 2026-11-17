import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferredContent } from './DeferredContent';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DeferredContent', () => {
  it('mounts content only when approaching the viewport and disconnects its observer', () => {
    let notify: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    const MockObserver = vi.fn(function (callback: IntersectionObserverCallback) {
      notify = callback;
      return { observe, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', MockObserver);
    render(<DeferredContent placeholder={<p>Waiting</p>}><p>Loaded</p></DeferredContent>);

    expect(screen.queryByText('Loaded')).not.toBeInTheDocument();
    expect(observe).toHaveBeenCalledOnce();
    expect(MockObserver).toHaveBeenCalledWith(expect.any(Function), { rootMargin: '200px' });
    act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.queryByText('Waiting')).not.toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('loads normally when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DeferredContent placeholder={<p>Waiting</p>}><p>Loaded</p></DeferredContent>);
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
