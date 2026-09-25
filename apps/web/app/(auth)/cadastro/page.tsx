'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import {
  IconeAgenda, IconeCadeado, IconeEmail, IconeGoogle, IconeLaudos, IconeProdutores, IconeUsuario,
} from '@/components/icones';

const RECURSOS = [
  { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe suas atividades com praticidade.' },
  { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
  { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Mantenha todas as informações em um só lugar.' },
];

export default function Cadastro() {
  const router = useRouter();
  const [f, setF] = useState({ nome: '', escritorio: '', crea: '', email: '', senha: '', confirmar: '' });
  const [aceite, setAceite] = useState(false);
  const [estado, setEstado] = useState<'form' | 'enviando' | 'confirmar'>('form');
  const [erro, setErro] = useState<string | null>(null);

  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (f.senha !== f.confirmar) {
      setErro('As senhas não são iguais.');
      return;
    }
    setEstado('enviando');
    setErro(null);
    const sb = criarClienteNavegador();
    const { data, error } = await sb.auth.signUp({
      email: f.email,
      password: f.senha,
      options: { data: { role: 'consultor', nome: f.nome, crea: f.crea, escritorio: f.escritorio } },
    });
    if (error) {
      setErro(error.message);
      setEstado('form');
      return;
    }
    // confirmações desligadas (dev) => já vem sessão
    if (data.session) {
      router.replace('/app');
      return;
    }
    setEstado('confirmar');
  }

  async function entrarComGoogle() {
    setErro(null);
    const sb = criarClienteNavegador();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) setErro('Cadastro com Google ainda não está disponível.');
  }

  if (estado === 'confirmar') {
    return (
      <TelaAuth
        imagem="/banners/tecnico-campo.jpg"
        tagline="Assistência técnica"
        headline={<>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>}
        descricao="Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar."
        recursos={RECURSOS}
        titulo="Confirme seu e-mail"
        legenda={`Enviamos um e-mail de confirmação para ${f.email}. Confirme e faça login — na primeira entrada o app cria seu escritório e copia as tabelas de referência padrão.`}
      >
        <Link className="btn verde" href="/login" style={{ width: '100%', justifyContent: 'center' }}>Ir para o login</Link>
      </TelaAuth>
    );
  }

  return (
    <TelaAuth
      imagem="/banners/tecnico-campo.jpg"
      tagline="Assistência técnica"
      headline={<>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>}
      descricao="Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar."
      recursos={RECURSOS}
      abas={{ entrarHref: '/login', criarHref: '/cadastro', ativa: 'criar' }}
      titulo="Criar sua conta"
      legenda="Comece a usar o AgroTech e tenha toda a gestão técnica do seu trabalho no campo."
    >
      <form onSubmit={enviar}>
        <label>
          Seu nome
          <CampoAuth icone={<IconeUsuario width={16} height={16} />} required autoComplete="name" placeholder="Seu nome completo" {...campo('nome')} />
        </label>
        <label>Nome do escritório<input required autoComplete="organization" {...campo('escritorio')} /></label>
        <label>CREA<input {...campo('crea')} /></label>
        <label>
          E-mail
          <CampoAuth icone={<IconeEmail width={16} height={16} />} type="email" required autoComplete="email" placeholder="seu@email.com" {...campo('email')} />
        </label>
        <label>
          Senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} required minLength={8} autoComplete="new-password" placeholder="Crie uma senha" {...campo('senha')} />
        </label>
        <label>
          Confirmar senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} required minLength={8} autoComplete="new-password" placeholder="Confirme sua senha" {...campo('confirmar')} />
        </label>
        <div className="tela-auth-termos">
          <input type="checkbox" id="aceite" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
          <label htmlFor="aceite">
            Li e aceito os <Link href="/termos" target="_blank">termos de uso</Link> e a{' '}
            <Link href="/privacidade" target="_blank">política de privacidade</Link>.
          </label>
        </div>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={estado === 'enviando' || !aceite}>
          {estado === 'enviando' ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      <div className="tela-auth-ou">ou</div>
      <button type="button" className="btn-google" onClick={entrarComGoogle}>
        <IconeGoogle /> Continuar com Google
      </button>
    </TelaAuth>
  );
}
