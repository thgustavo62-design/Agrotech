'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import { FOTO_PRODUTOR } from '@/components/banner-hero';
import { IconeAnalises, IconeCadeado, IconeEmail, IconeFinanceiro, IconeTalhoes } from '@/components/icones';

interface Resumo {
  valido: boolean;
  organizacao: string | null;
  produtor: string | null;
  email: string | null;
}

const RECURSOS = [
  { icone: <IconeTalhoes />, titulo: 'Seus talhões', descricao: 'Área, cultura e situação de cada talhão da sua propriedade.' },
  { icone: <IconeAnalises />, titulo: 'Análises de solo', descricao: 'Resultados e recomendações explicados em linguagem simples.' },
  { icone: <IconeFinanceiro />, titulo: 'Financeiro da lavoura', descricao: 'Custos e receitas da sua produção, separados do seu técnico.' },
];

function CartaoAceitar({ titulo, legenda, children }: { titulo: string; legenda?: string; children?: React.ReactNode }) {
  return (
    <TelaAuth
      imagem={FOTO_PRODUTOR}
      tagline="Sua lavoura"
      headline={<>Seus talhões, análises e resultados <em>em um só lugar.</em></>}
      descricao="Acompanhe o trabalho do seu técnico e a situação da sua lavoura direto do celular."
      recursos={RECURSOS}
      titulo={titulo}
      legenda={legenda}
    >
      {children}
    </TelaAuth>
  );
}

export default function AceitarConvite() {
  return (
    <Suspense fallback={<CartaoAceitar titulo="Carregando…" />}>
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

  if (resumo === 'carregando') return <CartaoAceitar titulo="Carregando…" />;

  if (!resumo || !resumo.valido) {
    return (
      <CartaoAceitar titulo="Convite inválido" legenda="Convite inválido, já usado ou expirado. Peça um novo ao seu técnico." />
    );
  }

  return (
    <CartaoAceitar
      titulo="Criar seu acesso"
      legenda={`${resumo.organizacao} liberou seu acesso ao painel de ${resumo.produtor}. Crie uma senha para entrar.`}
    >
      <form onSubmit={aceitar}>
        <label>
          E-mail
          <CampoAuth icone={<IconeEmail width={16} height={16} />} value={resumo.email ?? ''} disabled />
        </label>
        <label>
          Senha (mínimo 10 caracteres)
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={10} autoComplete="new-password" />
        </label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Concluindo…' : 'Criar acesso'}
        </button>
      </form>
    </CartaoAceitar>
  );
}
