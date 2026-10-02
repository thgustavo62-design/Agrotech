'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { lerParametrosRedefinicao } from '@/lib/acesso-equipe';
import { nivelDaSenha, regrasDaSenha } from '@/lib/senha';
import { TelaAuth } from '@/components/tela-auth';
import { CampoSenha } from '@/components/campo-auth';
import { IconeAgenda, IconeCadeado, IconeLaudos, IconeProdutores } from '@/components/icones';

const RECURSOS = [
  { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe as atividades do escritório.' },
  { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
  { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Os mesmos clientes do escritório, todos em um só lugar.' },
];

function Cartao({ titulo, legenda, children }: { titulo: string; legenda?: string; children?: React.ReactNode }) {
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

export default function RedefinirSenha() {
  return (
    <Suspense fallback={<Cartao titulo="Carregando…" />}>
      <RedefinirSenhaInterno />
    </Suspense>
  );
}

function RedefinirSenhaInterno() {
  const router = useRouter();
  const busca = useSearchParams().toString();
  // o Supabase pode devolver o erro (link expirado) na âncora #…, que o servidor não enxerga: lê no navegador
  const [ancora, setAncora] = useState<string | null>(null);
  useEffect(() => setAncora(window.location.hash), []);
  const params = lerParametrosRedefinicao(busca, ancora ?? '');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [estado, setEstado] = useState<'form' | 'enviando'>('form');
  const [erro, setErro] = useState<string | null>(null);
  // o link é de uso único: depois de trocado por sessão, uma segunda tentativa de senha reaproveita a sessão
  const [comSessao, setComSessao] = useState(false);

  const regras = regrasDaSenha(senha);
  const pronta = regras.every((r) => r.ok) && senha === confirma;

  if (ancora === null) return <Cartao titulo="Carregando…" />;

  if (!params) {
    return (
      <Cartao titulo="Link inválido" legenda="Este link de nova senha expirou, já foi usado ou está incompleto. Peça um novo a quem administra o escritório (ou use o link Esqueci minha senha, no login).">
        <Link className="btn verde" href="/login">Ir para o login</Link>
      </Cartao>
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronta || !params) return;
    setEstado('enviando');
    setErro(null);
    const sb = criarClienteNavegador();

    if (!comSessao) {
      const { error } = 'tokenHash' in params
        ? await sb.auth.verifyOtp({ token_hash: params.tokenHash, type: 'recovery' })
        : await sb.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken });
      if (error) {
        setEstado('form');
        setErro('Este link já foi usado ou expirou. Peça um novo.');
        return;
      }
      setComSessao(true);
    }

    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) {
      setEstado('form');
      setErro(/same|diferente/i.test(error.message) ? 'A nova senha precisa ser diferente da anterior.' : 'Não foi possível salvar a senha. Confira as regras abaixo e tente de novo.');
      return;
    }
    router.replace('/app');
  }

  return (
    <Cartao titulo="Criar nova senha" legenda="Escolha uma senha para voltar a entrar. Este link só funciona uma vez.">
      <form onSubmit={salvar} noValidate>
        <label>
          Nova senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </label>
        <div className="forca" data-nivel={nivelDaSenha(senha)} aria-hidden="true"><i /><i /><i /><i /></div>
        <ul className="regras" aria-label="Regras da senha">
          {regras.map((r) => <li key={r.texto} data-ok={r.ok}>{r.texto}</li>)}
        </ul>
        <label style={{ marginTop: 14 }}>
          Repita a nova senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
        </label>
        {confirma && senha !== confirma ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: '8px 0 0' }}>As senhas não são iguais.</p> : null}
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={!pronta || estado === 'enviando'}>
          {estado === 'enviando' ? 'Salvando…' : 'Salvar senha e entrar'}
        </button>
      </form>
    </Cartao>
  );
}
