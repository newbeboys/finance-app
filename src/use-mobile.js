import { useState, useEffect } from 'react';

// Use matchMedia.matches (not window.innerWidth) so the initial value
// uses the same source as CSS media queries. In Capacitor WebView,
// window.innerWidth can temporarily report hardware pixel width before
// the viewport meta tag is processed, causing a false desktop reading.
export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    // Sync once in case value changed between render and effect
    setMobile(mql.matches);
    const handler = e => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}
