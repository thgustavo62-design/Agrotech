'use client';

import { SITES, SITES_ORDEM, type SiteId } from '@/lib/sites';

/**
 * "Para onde você quer ir?" — a escolha do site na tela de login. Não navega: avisa a página, que troca o texto e as cores
 * e guarda o que a pessoa já digitou (e-mail e senha continuam no formulário).
 */
export function SeletorDeSite({ ativo, aoEscolher }: { ativo: SiteId; aoEscolher: (site: SiteId) => void }) {
  return (
    <div className="seletor-site" role="group" aria-label="Para onde você quer ir?">
      <span>Para onde você quer ir?</span>
      <div className="seletor-site-opcoes">
        {SITES_ORDEM.map((id) => (
          <button key={id} type="button" aria-pressed={ativo === id} onClick={() => aoEscolher(id)} data-site-opcao={id}>
            <b>{SITES[id].nome}</b>
            <small>{SITES[id].chamada}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
