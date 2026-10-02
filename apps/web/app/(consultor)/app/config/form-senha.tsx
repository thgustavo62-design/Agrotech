'use client';

import { useState } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { regrasDaSenha, nivelDaSenha } from '@/lib/senha';

/** Troca de senha. Roda no navegador: quem fala com o Auth é a sessão da própria pessoa. */
export function FormSenha() {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [estado, setEstado] = useState<'form' | 'enviando' | 'ok'>('form');
  const [erro, setErro] = useState<string | null>(null);

  const regras = regrasDaSenha(senha);
  const nivel = nivelDaSenha(senha);
  const pronta = regras.every((r) => r.ok) && senha === confirma;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronta) return;
    setEstado('enviando');
    setErro(null);
    const { error } = await criarClienteNavegador().auth.updateUser({ password: senha });
    if (error) {
      setEstado('form');
      setErro(/same|diferente/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível trocar a senha. Entre de novo e tente outra vez.');
      return;
    }
    setSenha('');
    setConfirma('');
    setEstado('ok');
  }

  return (
    <form onSubmit={salvar} className="grade g2" noValidate>
      <div className="campo">
        <label htmlFor="senha_nova">Nova senha</label>
        <input id="senha_nova" type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setEstado('form'); }} autoComplete="new-password" />
        <div className="forca" data-nivel={nivel} aria-hidden="true"><i /><i /><i /><i /></div>
        <ul className="regras" aria-label="Regras da senha">
          {regras.map((r) => <li key={r.texto} data-ok={r.ok}>{r.texto}</li>)}
        </ul>
      </div>
      <div className="campo">
        <label htmlFor="senha_confirma">Repita a nova senha</label>
        <input id="senha_confirma" type="password" value={confirma} onChange={(e) => { setConfirma(e.target.value); setEstado('form'); }} autoComplete="new-password" />
        {confirma && senha !== confirma ? <small style={{ color: 'var(--c-mb)', marginTop: 6 }}>As senhas não são iguais.</small> : null}
      </div>
      <div style={{ gridColumn: '1 / -1' }} aria-live="polite">
        <button className="btn verde" type="submit" disabled={!pronta || estado === 'enviando'}>
          {estado === 'enviando' ? 'Salvando…' : 'Trocar senha'}
        </button>
        {estado === 'ok' ? <span className="nota" style={{ marginLeft: 12, color: 'var(--folha)' }}>Senha alterada ✓</span> : null}
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: '10px 0 0' }}>{erro}</p> : null}
      </div>
    </form>
  );
}
