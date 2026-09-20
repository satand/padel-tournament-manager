'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Aggiorna i dati in proiezione senza ricaricare l'intera pagina.
export function PresentAutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
