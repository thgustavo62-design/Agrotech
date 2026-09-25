'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import { IconeAgenda, IconeCadeado, IconeEmail, IconeLaudos, IconeProdutores } from '@/components/icones';

interface Resumo {
  valido: boolean;
  organizacao: string | null;
  titulo: string | null;
  email: string | null;
}

const RECURSOS = [
  { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe as atividades do escritório.' },
  { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
  { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Os mesmos clientes do escritório, todos em um só lugar.' },
];

function CartaoAceitar({ titulo, legenda, children }: { titulo: string; legenda?: string; children?: React.ReactNode }) {
  return (
    <TelaAuth
      imagem="/banners/tecnico-campo.jpg"
      tagline="Assistência técnica"
      headline={<>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>}
      descricao="Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar."
      recursos={RECURSOS}
      titulo={titulo}
      legenda={legenda}
    >
      {children}
    </TelaAuth>
  );
}

export default function AceitarConviteEquipe() {
  return (
    <Suspense fallback={<CartaoAceitar titulo="Carregando…" />}>
      <AceitarConviteEquipeInterno />
    </Suspense>
  );
}

function AceitarConviteEquipeInterno() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [resumo, setResumo] = useState<Resumo | null | 'carregando'>('carregando');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<'form' | 'enviando'>('form');

  useEffect(() => {
    if (!token) { setResumo(null); return; }
    const sb = criarClienteNavegador();
    sb.schema('agro').rpc('convite_equipe_resumo', { p_token: token }).then(({ data }) => {
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
      options: { data: { role: 'consultor', nome: resumo.email.split('@')[0] } },
    });
    if (error && /already registered/i.test(error.message)) {
      ({ data, error } = await sb.auth.signInWithPassword({ email: resumo.email, password: senha }));
    }
    if (error || !data.session) {
      setEstado('form');
      setErro(error?.message ?? 'Confirme o e-mail e volte a abrir este link para concluir.');
      return;
    }

    const { data: orgId, error: eRpc } = await sb.schema('agro').rpc('aceitar_convite_equipe', { p_token: token });
    if (eRpc || !orgId) {
      setEstado('form');
      setErro('Não foi possível validar o convite. Ele pode ter expirado.');
      return;
    }
    await sb.auth.refreshSession();
    router.replace('/app');
  }

  if (resumo === 'carregando') return <CartaoAceitar titulo="Carregando…" />;

  if (!resumo || !resumo.valido) {
    return (
      <CartaoAceitar titulo="Convite inválido" legenda="Convite inválido, já usado ou expirado. Peça um novo a quem te convidou." />
    );
  }

  return (
    <CartaoAceitar
      titulo="Criar seu acesso"
      legenda={`${resumo.organizacao} te convidou${resumo.titulo ? ` como ${resumo.titulo}` : ''}. Crie uma senha para entrar.`}
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
