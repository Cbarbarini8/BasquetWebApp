import { useState, useEffect } from 'react';

// Activa layout compacto cuando la altura de la ventana es baja (celular horizontal).
// Umbral: 600px cubre iPhone/Android landscape. Tablets landscape quedan en modo normal.
export function useIsCompactScoring() {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-height: 600px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-height: 600px)');
    const handler = (e) => setCompact(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return compact;
}
