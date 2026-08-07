import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reveals an element as it scrolls into view: translateY(16px) -> 0 and
 * opacity 0 -> 1 over 500ms (`.reveal` / `.reveal-visible` in index.css).
 * One IntersectionObserver, disconnected as soon as the element has
 * revealed (or on unmount). Honours prefers-reduced-motion — the observer
 * never runs and the element starts, and stays, visible.
 */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible } as const;
}
