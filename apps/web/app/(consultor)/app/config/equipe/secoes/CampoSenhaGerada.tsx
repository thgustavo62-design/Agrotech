'use client';

import { regrasDaSenha, gerarSenha } from '@/lib/senha';

/**
 * Campo de senha para quem DEFINE a senha de outra pessoa: visível (o proprietário precisa vê-la para
 * repassar), com "Gerar senha" (legível, sem caracteres ambíguos) e as regras ao vivo.
 */
export function CampoSenhaGerada({
  id, valor, aoMudar, rotulo = 'Senha',
}: {
  id: string;
  valor: string;
  aoMudar: (v: string) => void;
  rotulo?: string;
}) {
  const regras = regrasDaSenha(valor);
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id={id} type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn sec mini" onClick={() => aoMudar(gerarSenha())}>Gerar senha</button>
      </div>
      <ul className="regras" aria-label="Regras da senha">
        {regras.map((r) => <li key={r.texto} data-ok={r.ok}>{r.texto}</li>)}
      </ul>
    </div>
  );
}
