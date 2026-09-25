'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import { IconeAgenda, IconeCadeado, IconeEmail, IconeGoogle, IconeLaudos, IconeProdutores } from '@/components/icones';

export default function LoginConsultor() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const sb = criarClienteNavegador();
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
      return;
    }
    router.replace('/app');
  }

  async function entrarComGoogle() {
    setErro(null);
    const sb = criarClienteNavegador();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) setErro('Login com Google ainda não está disponível.');
  }

  return (
    <TelaAuth
      imagem="/banners/tecnico-campo.jpg"
      tagline="Assistência técnica"
      headline={<>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>}
      descricao="Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar."
      recursos={[
        { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe suas atividades com praticidade.' },
        { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
        { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Mantenha todas as informações em um só lugar.' },
      ]}
      abas={{ entrarHref: '/login', criarHref: '/cadastro', ativa: 'entrar' }}
      titulo="Entrar na sua conta"
      legenda="Acesse o painel do seu escritório."
    >
      <form onSubmit={entrar}>
        <label>
          E-mail
          <CampoAuth icone={<IconeEmail width={16} height={16} />} type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button type="submit" className="btn verde" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="tela-auth-ou">ou</div>
      <button type="button" className="btn-google" onClick={entrarComGoogle}>
        <IconeGoogle /> Continuar com Google
      </button>
      <p className="tela-auth-rodape">
        Só quer ver? <Link href="/demo">abrir a vitrine</Link>.
      </p>
    </TelaAuth>
  );
}
