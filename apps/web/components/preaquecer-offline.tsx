'use client';

import { useEffect, useState } from 'react';

const MAXIMO = 8;

/**
 * Deixa no aparelho as páginas que o técnico vai precisar no campo (talhões das visitas dos próximos
 * dias), enquanto há sinal. O service worker guarda toda resposta same-origin que passa por ele; sem isto,
 * offline só abria o que já tinha sido visitado antes. Não faz nada sem service worker ativo, offline ou
 * com economia de dados ligada. Falha em uma página não interrompe as outras.
 *
 * Só o HTML não basta: a página de um talhão carrega um pedaço de JavaScript próprio (o "chunk" da rota) que o
 * navegador só baixa ao abrir a rota pela primeira vez; sem ele em cache, a página guardada abre e dá erro
 * ao hidratar. Por isso, junto com cada página, baixa-se também os arquivos /_next/static/ que ela cita.
 */
const ESTATICOS = /(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g;

export function PreAquecerOffline({ hrefs }: { hrefs: string[] }) {
  const [prontas, setProntas] = useState(0);
  const chave = hrefs.join('|');

  useEffect(() => {
    const lista = [...new Set(hrefs)].slice(0, MAXIMO);
    const economia = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (lista.length === 0 || !navigator.onLine || economia || !navigator.serviceWorker?.controller) return;

    let cancelado = false;
    const rodar = async () => {
      let ok = 0;
      const jaBaixados = new Set<string>();
      for (const href of lista) {
        if (cancelado || !navigator.onLine) break;
        try {
          const r = await fetch(href, { credentials: 'same-origin' });
          if (!r.ok || r.redirected) continue;
          const html = await r.text();
          for (const m of html.matchAll(ESTATICOS)) {
            const arquivo = m[1]!;
            if (jaBaixados.has(arquivo)) continue;
            jaBaixados.add(arquivo);
            await fetch(arquivo, { credentials: 'same-origin' }).catch(() => undefined);
          }
          ok++;
        } catch {
          /* sem sinal no meio do caminho: o que já foi guardado continua valendo */
        }
      }
      if (!cancelado) setProntas(ok);
    };
    // depois que a própria agenda terminou de carregar: não disputa banda com o que a pessoa está vendo
    const espera = setTimeout(() => void rodar(), 1500);
    return () => { cancelado = true; clearTimeout(espera); };
    // `hrefs` entra pela chave (a lista muda de identidade a cada render do servidor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (prontas === 0) return null;
  return (
    <p className="nota nao-imprime" role="status" style={{ margin: '0 0 12px' }}>
      ✓ {prontas === 1 ? '1 talhão das próximas visitas está' : `${prontas} talhões das próximas visitas estão`} salvo(s) no aparelho para abrir sem sinal.
    </p>
  );
}
