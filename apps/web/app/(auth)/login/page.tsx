'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
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
  const [aviso, setAviso] = useState<string | null>(null);

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

  // o Supabase manda o e-mail "Reset password" padrão. A resposta é sempre a
  // mesma, exista ou não a conta: não revela quem tem cadastro. Limite do SMTP embutido: 2 e-mails por hora.
  async function esqueciSenha() {
    setErro(null);
    setAviso(null);
    if (!email.trim()) {
      setErro('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".');
      return;
    }
    // fluxo *implicit*, só para este pedido: o link do e-mail traz os tokens na âncora e funciona abrindo em
    // OUTRO aparelho (o PKCE exige o mesmo navegador). Sessão não é guardada aqui.
    const sbRecuperacao = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await sbRecuperacao.auth.resetPasswordForEmail(email.trim(), {
      // precisa estar em Authentication > URL Configuration > Redirect URLs
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error && /rate|limit|many/i.test(error.message)) {
      setErro('Muitos pedidos seguidos. Espere um pouco e tente de novo.');
      return;
    }
    setAviso('Se este e-mail tiver cadastro, enviamos um link para criar uma nova senha. Confira também o spam.');
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
        {aviso ? <p role="status" style={{ color: 'var(--folha)', fontSize: 13, marginTop: 12 }}>{aviso}</p> : null}
        <button type="submit" className="btn verde" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="tela-auth-rodape" style={{ marginTop: 10 }}>
          <button type="button" className="link-sair" style={{ color: 'var(--folha)' }} onClick={esqueciSenha}>Esqueci minha senha</button>
        </p>
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
