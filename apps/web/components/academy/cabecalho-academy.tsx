'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BotaoSair } from '@/components/botao-sair';
import { rotaAtiva } from '@/lib/navegacao';

interface ItemMenu { href: string; rotulo: string; exato?: boolean }

/**
 * Cabeçalho do site da Academy: marca, menu de aluno, busca e a conta. Outro molde que o da Assistência Técnica
 * (que tem menu lateral); aqui é uma barra no topo, como em um site de cursos.
 */
export function CabecalhoAcademy({ nome, ehAluno, ehEstudio }: { nome: string | null; ehAluno: boolean; ehEstudio: boolean }) {
  const path = usePathname() ?? '';
  const itens: ItemMenu[] = [
    { href: '/academy', rotulo: 'Início', exato: true },
    { href: '/academy/cursos', rotulo: 'Cursos' },
    ...(ehAluno ? [{ href: '/academy/meus-cursos', rotulo: 'Meus cursos' }] : []),
    { href: '/academy/noticias', rotulo: 'Notícias' },
    ...(ehEstudio ? [{ href: '/academy/estudio', rotulo: 'Estúdio' }] : []),
  ];
  const ativo = (i: ItemMenu) => (i.exato ? path === i.href : rotaAtiva(path, i.href));

  return (
    <header className="ac-topo">
      <div className="ac-topo-interno">
        <Link className="ac-marca" href="/academy" aria-label="AgroTech Academy — início">
          <span className="ac-marca-simbolo" aria-hidden="true">◆</span>
          <span><b>AgroTech</b> Academy</span>
        </Link>
        <nav className="ac-menu" aria-label="Academy">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} data-ativo={ativo(i)} aria-current={ativo(i) ? 'page' : undefined}>{i.rotulo}</Link>
          ))}
        </nav>
        <form className="ac-busca" action="/academy/cursos" method="get" role="search">
          <input name="q" type="search" placeholder="Buscar cursos e aulas" aria-label="Buscar cursos e aulas" autoComplete="off" />
        </form>
        <details className="ac-conta">
          <summary aria-label="Minha conta">
            <span className="ac-conta-avatar" aria-hidden="true">{(nome ?? '?').trim().slice(0, 1).toUpperCase()}</span>
            <span className="ac-conta-nome">{nome ?? 'Minha conta'}</span>
          </summary>
          <div className="ac-conta-menu">
            <Link href="/sites">Trocar de site</Link>
            {ehAluno ? <Link href="/academy/meus-cursos">Meus certificados</Link> : null}
            <BotaoSair action="/academy/sair" className="ac-sair" rotulo="Sair" />
          </div>
        </details>
      </div>
    </header>
  );
}
