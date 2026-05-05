import { useEffect, useState } from 'react';

/**
 * SSR-safe media query hook. Returns `false` during server render to avoid
 * hydration mismatches; reads the real value after mount.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(query);

    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
};

export const useIsMobile = (breakpointPx = 768): boolean => {
  return !useMediaQuery(`(min-width: ${breakpointPx}px)`);
};
