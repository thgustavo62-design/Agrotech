'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BotaoSair } from '@/components/botao-sair';
import { rotaAtiva } from '@/lib/navegacao';

interface ItemMenu { href: string; rotulo: string; exato?: boolean }

/** Cabeçalho do site Connect: barra azul no topo; o menu muda conforme seja o produtor (pedidos) ou a equipe (fila). */
export function CabecalhoConnect({ nome, ehEquipe, naoLidas }: { nome: string | null; ehEquipe: boolean; naoLidas: number }) {
  const path = usePathname() ?? '';
  const itens: ItemMenu[] = ehEquipe
    ? [
        { href: '/connect/fila', rotulo: 'Fila de atendimento' },
        { href: '/connect/atendimentos/novo', rotulo: 'Novo atendimento' },
        { href: '/connect/avisos', rotulo: 'Avisos' },
      ]
    : [
        { href: '/connect', rotulo: 'Início', exato: true },
        { href: '/connect/pedidos', rotulo: 'Meus pedidos', exato: true },
        { href: '/connect/pedidos/novo', rotulo: 'Novo pedido' },
        { href: '/connect/avisos', rotulo: 'Avisos' },
      ];
  const ativo = (i: ItemMenu) => (i.exato ? path === i.href : rotaAtiva(path, i.href));

  return (
    <header className="cn-topo">
      <div className="cn-topo-interno">
        <Link className="cn-marca" href="/connect" aria-label="AgroTech Connect — início">
          <span className="cn-marca-simbolo" aria-hidden="true">●</span>
          <span><b>AgroTech</b> Connect</span>
        </Link>
        <nav className="cn-menu" aria-label="Connect">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} data-ativo={ativo(i)} aria-current={ativo(i) ? 'page' : undefined}>
              {i.rotulo}
              {i.href === '/connect/avisos' && naoLidas > 0 ? (
                <span className="cn-contagem" aria-label={`${naoLidas} não lidos`}>{naoLidas > 9 ? '9+' : naoLidas}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <details className="cn-conta">
          <summary aria-label="Minha conta">
            <span className="cn-conta-avatar" aria-hidden="true">{(nome ?? '?').trim().slice(0, 1).toUpperCase()}</span>
            <span className="cn-conta-nome">{nome ?? 'Minha conta'}</span>
          </summary>
          <div className="cn-conta-menu">
            <Link href="/sites">Trocar de site</Link>
            <BotaoSair action="/connect/sair" className="cn-sair" rotulo="Sair" />
          </div>
        </details>
      </div>
    </header>
  );
}
