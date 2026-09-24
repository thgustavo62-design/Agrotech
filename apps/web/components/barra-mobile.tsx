'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVEGACAO_CONSULTOR, NAVEGACAO_MOBILE_PRINCIPAL, rotaAtiva } from '@/lib/navegacao';
import { IconeMais, IconeFechar } from './icones';

/** Barra inferior (mobile, <960px): os 5 itens mais usados + "Mais" abre a gaveta com o resto. */
export function BarraMobile() {
  const path = usePathname();
  const [aberta, setAberta] = useState(false);

  const todosItens = NAVEGACAO_CONSULTOR.flatMap((g) => g.itens);
  const principais = NAVEGACAO_MOBILE_PRINCIPAL
    .map((href) => todosItens.find((i) => i.href === href))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));
  const ativaEmAlgumPrincipal = principais.some((i) => rotaAtiva(path, i.href));

  return (
    <>
      <nav className="barra-mobile nao-imprime" aria-label="Navegação principal">
        {principais.map((item) => {
          const ativa = rotaAtiva(path, item.href);
          const Icone = item.icone;
          return (
            <Link key={item.href} href={item.href} className="barra-mobile-item" data-ativa={ativa}>
              <Icone />
              {item.rotulo}
            </Link>
          );
        })}
        <button
          type="button"
          className="barra-mobile-item"
          data-ativa={!ativaEmAlgumPrincipal}
          onClick={() => setAberta(true)}
        >
          <IconeMais />
          Mais
        </button>
      </nav>

      {aberta && (
        <div className="superposicao" onClick={(e) => { if (e.target === e.currentTarget) setAberta(false); }}>
          <div className="gaveta" role="dialog" aria-modal="true" aria-label="Mais opções">
            <div className="gaveta-topo">
              <strong style={{ fontSize: 15 }}>Mais</strong>
              <button type="button" className="gaveta-fechar" onClick={() => setAberta(false)} aria-label="Fechar">
                <IconeFechar width={16} height={16} />
              </button>
            </div>
            {NAVEGACAO_CONSULTOR.map((grupo) => (
              <div className="lateral-grupo" key={grupo.titulo}>
                <div className="lateral-grupo-titulo">{grupo.titulo}</div>
                {grupo.itens.map((item) => {
                  const ativa = rotaAtiva(path, item.href);
                  const Icone = item.icone;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="lateral-item"
                      data-ativa={ativa}
                      onClick={() => setAberta(false)}
                    >
                      <Icone />
                      <span className="lateral-rotulo">{item.rotulo}</span>
                      {item.embreve ? <span className="selo-embreve">em breve</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
