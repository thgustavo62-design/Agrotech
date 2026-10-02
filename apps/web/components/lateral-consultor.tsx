'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hrefAtivo, navegacaoPara } from '@/lib/navegacao';

const CHAVE_COLAPSADA = 'agrotech.lateral.colapsada';

/**
 * Sidebar agrupada da Central do Agrônomo (desktop, ≥960px — abaixo disso vira
 * a barra inferior em `barra-mobile.tsx`). Todo item é um link de verdade,
 * mesmo os marcados "em breve": a página de destino explica o que falta, em
 * vez de um item de menu morto.
 */
export function LateralConsultor({ perfis }: { perfis?: string[] | null }) {
  const path = usePathname();
  const grupos = navegacaoPara(perfis);
  const atual = hrefAtivo(path, grupos.flatMap((g) => g.itens.map((i) => i.href)));
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    try {
      setColapsada(localStorage.getItem(CHAVE_COLAPSADA) === '1');
    } catch {
      /* localStorage indisponível — mantém expandida */
    }
  }, []);

  function alternar() {
    setColapsada((atual) => {
      const novo = !atual;
      try { localStorage.setItem(CHAVE_COLAPSADA, novo ? '1' : '0'); } catch { /* ignora */ }
      return novo;
    });
  }

  return (
    <aside className="lateral nao-imprime" data-colapsada={colapsada} aria-label="Navegação principal">
      {grupos.map((grupo) => (
        <div className="lateral-grupo" key={grupo.titulo}>
          <div className="lateral-grupo-titulo">{grupo.titulo}</div>
          {grupo.itens.map((item) => {
            const ativa = item.href === atual;
            const Icone = item.icone;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="lateral-item"
                data-ativa={ativa}
                data-embreve={item.embreve || undefined}
                title={colapsada ? item.rotulo : undefined}
              >
                <Icone />
                <span className="lateral-rotulo">{item.rotulo}</span>
                {item.embreve ? <span className="selo-embreve">em breve</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
      <button type="button" className="lateral-colapsar" onClick={alternar}>
        {colapsada ? '»' : '« Recolher'}
      </button>
    </aside>
  );
}
