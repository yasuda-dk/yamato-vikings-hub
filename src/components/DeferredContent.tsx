import { useEffect, useRef, useState, type ReactNode } from 'react';

export function DeferredContent({ children, placeholder }: { children: ReactNode; placeholder: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!target.current) return;
    if (typeof window.IntersectionObserver !== 'function') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={target}>{visible ? children : placeholder}</div>;
}
