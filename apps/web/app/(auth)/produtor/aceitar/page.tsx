'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';

interface Resumo {
  valido: boolean;
  organizacao: string | null;
  produtor: string | null;
  email: string | null;
}

export default function AceitarConvite() {
  return (
    <Suspense fallback={<div className="tela-login"><p>Carregando…</p></div>}>
      <AceitarConviteInterno />
    </Suspense>
  );
}

function AceitarConviteInterno() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [resumo, setResumo] = useState<Resumo | null | 'carregando'>('carregando');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<'form' | 'enviando'>('form');

  useEffect(() => {
    if (!token) { setResumo(null); return; }
    const sb = criarClienteNavegador();
    sb.schema('agro').rpc('convite_resumo', { p_token: token }).then(({ data }) => {
      setResumo((data as Resumo | null) ?? null);
    });
  }, [token]);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    if (resumo === 'carregando' || !resumo?.valido || !resumo.email) return;
    setEstado('enviando');
    setErro(null);
    const sb = criarClienteNavegador();

    // cria a conta (ou entra, se já existir)
    let { data, error } = await sb.auth.signUp({
      email: resumo.email,
      password: senha,
      options: { data: { role: 'produtor', nome: resumo.produtor } },
    });
    if (error && /already registered/i.test(error.message)) {
      ({ data, error } = await sb.auth.signInWithPassword({ email: resumo.email, password: senha }));
    }
    if (error || !data.session) {
      setEstado('form');
      setErro(error?.message ?? 'Confirme o e-mail e volte a abrir este link para concluir.');
      return;
    }

    // faz o vínculo produtor <-> organização
    const { data: prodId, error: eRpc } = await sb.schema('agro').rpc('aceitar_convite', { p_token: token });
    if (eRpc || !prodId) {
      setEstado('form');
      setErro('Não foi possível validar o convite. Ele pode ter expirado.');
      return;
    }
    await sb.auth.refreshSession();
    router.replace('/produtor');
  }

  if (resumo === 'carregando') return <div className="tela-login"><p>Carregando…</p></div>;

  if (!resumo || !resumo.valido) {
    return (
      <div className="tela-login">
        <div className="marca">AgroTech <span>Sua lavoura</span></div>
        <p>Convite inválido, já usado ou expirado. Peça um novo ao seu técnico.</p>
      </div>
    );
  }

  return (
    <div className="tela-login">
      <div className="marca">AgroTech <span>Sua lavoura</span></div>
      <p>
        <b>{resumo.organizacao}</b> liberou seu acesso ao painel de <b>{resumo.produtor}</b>.
        Crie uma senha para entrar.
      </p>
      <form onSubmit={aceitar}>
        <label>E-mail<input value={resumo.email ?? ''} disabled /></label>
        <label>Senha (mínimo 10 caracteres)
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={10} autoComplete="new-password" />
        </label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Concluindo…' : 'Criar acesso'}
        </button>
      </form>
    </div>
  );
}
