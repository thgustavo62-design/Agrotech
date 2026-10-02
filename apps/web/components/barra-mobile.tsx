'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hrefAtivo, navegacaoPara, NAVEGACAO_MOBILE_PRINCIPAL } from '@/lib/navegacao';
import { IconeMais, IconeFechar } from './icones';
import { BotaoSair } from './botao-sair';

export interface ItemBarra {
  href: string;
  rotulo: string;
  icone: ComponentType<SVGProps<SVGSVGElement>>;
  embreve?: boolean;
}
export interface GrupoBarra {
  titulo?: string;
  itens: ItemBarra[];
}

/**
 * Barra inferior (celular, <960px): os itens principais + "Mais", que abre a gaveta com o resto,
 * o nome da pessoa e o botão de sair (o cabeçalho do celular não tem espaço para eles).
 * Usada pelo consultor e pelo produtor.
 */
export function BarraInferior({
  grupos, principais, nome, subtitulo, sairAction,
}: {
  grupos: GrupoBarra[];
  /** `href` dos itens fixos na barra (os demais ficam em "Mais") */
  principais: string[];
  nome?: string | null;
  subtitulo?: string | null;
  sairAction?: string;
}) {
  const path = usePathname();
  const [aberta, setAberta] = useState(false);

  const todos = grupos.flatMap((g) => g.itens);
  const fixos = principais.map((href) => todos.find((i) => i.href === href)).filter((i): i is ItemBarra => Boolean(i));
  const atual = hrefAtivo(path, todos.map((i) => i.href));
  const ativaEmFixo = fixos.some((i) => i.href === atual);

  // a gaveta fecha ao navegar e com a tecla Esc; e a página de trás não rola enquanto ela está aberta
  useEffect(() => setAberta(false), [path]);
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(false); };
    window.addEventListener('keydown', aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', aoTeclar); document.body.style.overflow = anterior; };
  }, [aberta]);

  return (
    <>
      <nav className="barra-mobile nao-imprime" aria-label="Navegação principal">
        {fixos.map((item) => {
          const ativa = item.href === atual;
          const Icone = item.icone;
          return (
            <Link key={item.href} href={item.href} className="barra-mobile-item" data-ativa={ativa} aria-current={ativa ? 'page' : undefined}>
              <Icone />
              {item.rotulo}
            </Link>
          );
        })}
        <button
          type="button"
          className="barra-mobile-item"
          data-ativa={!ativaEmFixo}
          onClick={() => setAberta(true)}
          aria-haspopup="dialog"
          aria-expanded={aberta}
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
            {grupos.map((grupo, gi) => (
              <div className="lateral-grupo" key={grupo.titulo ?? gi}>
                {grupo.titulo ? <div className="lateral-grupo-titulo">{grupo.titulo}</div> : null}
                {grupo.itens.map((item) => {
                  const ativa = item.href === atual;
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
            <div className="gaveta-conta">
              <div>
                <b>{nome ?? 'Minha conta'}</b>
                {subtitulo ? <small>{subtitulo}</small> : null}
              </div>
              <BotaoSair action={sairAction} className="btn sec" rotulo="Sair da conta" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Barra do consultor: itens e ordem vêm de NAVEGACAO_CONSULTOR (mesma fonte da sidebar). */
export function BarraMobile({ nome, crea, perfis }: { nome?: string | null; crea?: string | null; perfis?: string[] | null }) {
  return (
    <BarraInferior
      grupos={navegacaoPara(perfis)}
      principais={NAVEGACAO_MOBILE_PRINCIPAL}
      nome={nome}
      subtitulo={crea ? `CREA ${crea}` : 'Defina seu CREA em Configurações'}
    />
  );
}
