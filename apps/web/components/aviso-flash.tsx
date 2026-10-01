'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { COOKIE_AVISO, PARAM_AVISO } from '@/lib/acao-constantes';

/**
 * Mostra o aviso que uma server action deixou no cookie (ver lib/acao.ts). O redirect de
 * volta traz um marcador `_a` na URL só para este componente reagir mesmo quando o caminho
 * é o mesmo; o TEXTO vem do cookie, que só o servidor grava — um link forjado não consegue
 * escrever mensagem na tela.
 */
/** O servidor codifica a mensagem e o Next pode codificar de novo: decodifica enquanto houver %XX. */
function decodificar(valor: string): string {
  let r = valor;
  for (let i = 0; i < 2 && /%[0-9A-Fa-f]{2}/.test(r); i++) {
    try { r = decodeURIComponent(r); } catch { break; }
  }
  return r;
}

function Aviso() {
  const caminho = usePathname();
  const params = useSearchParams();
  const marca = params.get(PARAM_AVISO);
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    const par = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_AVISO}=`));
    if (par) {
      setTexto(decodificar(par.slice(COOKIE_AVISO.length + 1)));
      document.cookie = `${COOKIE_AVISO}=; Max-Age=0; path=/`;
    }
    if (marca) {
      // tira o marcador da barra de endereço sem recarregar
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAM_AVISO);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, [caminho, marca]);

  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(() => setTexto(null), 15000);
    return () => clearTimeout(t);
  }, [texto]);

  if (!texto) return null;
  return (
    <div
      role="alert"
      className="aviso nao-imprime"
      style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 100, maxWidth: 640, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-start' }}
    >
      <span style={{ flex: 1 }}>{texto}</span>
      <button type="button" className="btn sec mini" onClick={() => setTexto(null)} aria-label="Fechar aviso">Fechar</button>
    </div>
  );
}

export function AvisoFlash() {
  return (
    <Suspense fallback={null}>
      <Aviso />
    </Suspense>
  );
}
