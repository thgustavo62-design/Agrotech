'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROTULOS_SEGMENTO } from '@/lib/navegacao';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trilha estrutural (qual lista você está vendo), não identidade da entidade
 * — o título da própria página já mostra o nome do produtor/talhão/etc.
 * Por isso um segmento de id (uuid) não vira uma migalha própria: apenas é
 * pulado, e a trilha some quando não sobra nada além da raiz.
 */
export function Breadcrumbs() {
  const path = usePathname();
  const segmentos = path.split('/').filter(Boolean); // ex.: ['app','produtores','<uuid>','editar']

  if (segmentos[0] !== 'app' || segmentos.length <= 1) return null;

  const migalhas: Array<{ rotulo: string; href: string }> = [];
  let acumulado = '';
  for (const seg of segmentos) {
    acumulado += `/${seg}`;
    if (RE_UUID.test(seg)) continue; // não vira migalha — a página mostra a identidade
    migalhas.push({ rotulo: ROTULOS_SEGMENTO[seg] ?? seg, href: acumulado });
  }
  if (migalhas.length <= 1) return null;

  return (
    <nav className="migalhas nao-imprime" aria-label="Trilha de navegação">
      {migalhas.map((m, i) => {
        const ultima = i === migalhas.length - 1;
        return (
          <span key={m.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 ? <span className="sep">/</span> : null}
            {ultima ? <span className="atual">{m.rotulo}</span> : <Link href={m.href}>{m.rotulo}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
