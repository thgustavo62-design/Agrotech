'use client';

import { useState, type ReactNode } from 'react';

export interface Painel {
  id: string;
  rotulo: string;
  contagem?: number;
  conteudo: ReactNode;
}

/**
 * Abas de conteúdo dentro de uma página (não confundir com a navegação
 * lateral/inferior do app, que navega entre rotas). Usado pelas páginas
 * "360º" — todo o conteúdo já vem carregado do servidor; a troca de aba é
 * só estado local, sem requisição.
 */
export function AbasPaineis({ paineis, inicial }: { paineis: Painel[]; inicial?: string }) {
  const [ativa, setAtiva] = useState(inicial ?? paineis[0]?.id ?? '');
  const painel = paineis.find((p) => p.id === ativa) ?? paineis[0];

  return (
    <div>
      <div
        className="abas"
        style={{
          position: 'static', background: 'none', backdropFilter: 'none',
          borderBottom: '1px solid var(--linha)', padding: '0 0 8px', margin: '0 0 16px',
        }}
      >
        {paineis.map((p) => (
          <button
            key={p.id}
            type="button"
            className="aba"
            data-ativa={p.id === painel?.id}
            onClick={() => setAtiva(p.id)}
          >
            {p.rotulo}
            {p.contagem ? <span className="nota" style={{ marginLeft: 5 }}>{p.contagem}</span> : null}
          </button>
        ))}
      </div>
      {painel?.conteudo}
    </div>
  );
}
