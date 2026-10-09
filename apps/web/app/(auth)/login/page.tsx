'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { siteDeValor, type SiteId } from '@/lib/sites';
import { TelaAuth, type RecursoAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import { SeletorDeSite } from '@/components/seletor-de-site';
import { FOTO_CAFE, FOTO_CONSULTOR, FOTO_PRODUTOR } from '@/components/banner-hero';
import {
  IconeAcademy, IconeAgenda, IconeAnalises, IconeCadeado, IconeEmail, IconeFinanceiro, IconeGoogle, IconeLaudos,
  IconeMonitoramento, IconeProdutores, IconeTalhoes,
} from '@/components/icones';

interface TextoDoSite {
  imagem: string;
  tagline: string;
  headline: ReactNode;
  descricao: string;
  recursos: RecursoAuth[];
  titulo: string;
  legenda: string;
}

/** O que cada site diz na entrada. Assistência Técnica muda o texto para quem é produtor (o destino vem do papel da conta). */
function textoDoSite(site: SiteId, produtor: boolean): TextoDoSite {
  if (site === 'academy') {
    return {
      imagem: FOTO_CAFE,
      tagline: 'Academy',
      headline: <>Aprenda no seu ritmo, <em>com o que o seu agrônomo escolheu.</em></>,
      descricao: 'Cursos, aulas em vídeo e texto e certificados de participação, no celular ou no computador.',
      recursos: [
        { icone: <IconeAcademy />, titulo: 'Cursos e trilhas', descricao: 'Aulas organizadas em módulos, do básico ao avançado.' },
        { icone: <IconeLaudos />, titulo: 'Indicado para você', descricao: 'O que o seu agrônomo recomenda depois de uma visita ou de um laudo.' },
        { icone: <IconeAnalises />, titulo: 'Certificado', descricao: 'Ao concluir um curso você emite o certificado de participação.' },
      ],
      titulo: 'Entrar na Academy',
      legenda: 'Use o mesmo e-mail e a mesma senha da sua conta AgroTech.',
    };
  }
  if (site === 'connect') {
    return {
      imagem: FOTO_CONSULTOR,
      tagline: 'Connect',
      headline: <>Fale com o seu técnico e <em>acompanhe cada pedido.</em></>,
      descricao: 'Peça ajuda com fotos, diga onde está o problema e veja o andamento até o retorno.',
      recursos: [
        { icone: <IconeMonitoramento />, titulo: 'Pedidos com foto', descricao: 'Mostre o problema da lavoura sem precisar escrever muito.' },
        { icone: <IconeAgenda />, titulo: 'Andamento e retorno', descricao: 'Saiba quem está cuidando, o prazo e quando o técnico volta.' },
        { icone: <IconeProdutores />, titulo: 'Tudo em um histórico', descricao: 'Visitas, pedidos e orientações juntos, por produtor.' },
      ],
      titulo: 'Entrar no Connect',
      legenda: 'Use o mesmo e-mail e a mesma senha da sua conta AgroTech.',
    };
  }
  if (produtor) {
    return {
      imagem: FOTO_PRODUTOR,
      tagline: 'Assistência Técnica · Sua lavoura',
      headline: <>Seus talhões, análises e resultados <em>em um só lugar.</em></>,
      descricao: 'Acompanhe o trabalho do seu técnico e a situação da sua lavoura direto do celular.',
      recursos: [
        { icone: <IconeTalhoes />, titulo: 'Seus talhões', descricao: 'Área, cultura e situação de cada talhão da sua propriedade.' },
        { icone: <IconeAnalises />, titulo: 'Análises de solo', descricao: 'Resultados e recomendações explicados em linguagem simples.' },
        { icone: <IconeFinanceiro />, titulo: 'Financeiro da lavoura', descricao: 'Custos e receitas da sua produção, separados do seu técnico.' },
      ],
      titulo: 'Entrar na sua conta',
      legenda: 'Entrada do produtor. O acesso é criado pelo seu técnico.',
    };
  }
  return {
    imagem: '/banners/tecnico-campo.jpg',
    tagline: 'Assistência Técnica',
    headline: <>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>,
    descricao: 'Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar.',
    recursos: [
      { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe suas atividades com praticidade.' },
      { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
      { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Mantenha todas as informações em um só lugar.' },
    ],
    titulo: 'Entrar na sua conta',
    legenda: 'Acesse o painel do seu escritório.',
  };
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const site = siteDeValor(params.get('site'));
  const produtor = site === 'assistencia' && params.get('como') === 'produtor';
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const t = textoDoSite(site, produtor);

  function escolher(novo: SiteId) {
    setErro(null);
    setAviso(null);
    router.replace(`/login?site=${novo}`, { scroll: false });
  }

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
    // a página inicial decide o destino pelo site escolhido e pelo papel da conta (escritório × produtor)
    router.replace(`/?site=${site}`);
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
    const destino = site === 'assistencia' ? '/app' : `/${site}`;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${destino}` },
    });
    if (error) setErro('Login com Google ainda não está disponível.');
  }

  return (
    <TelaAuth
      site={site}
      seletor={<SeletorDeSite ativo={site} aoEscolher={escolher} />}
      imagem={t.imagem}
      tagline={t.tagline}
      headline={t.headline}
      descricao={t.descricao}
      recursos={t.recursos}
      abas={site === 'assistencia' && !produtor ? { entrarHref: '/login?site=assistencia', criarHref: '/cadastro', ativa: 'entrar' } : undefined}
      titulo={t.titulo}
      legenda={t.legenda}
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
      {site === 'assistencia' ? (
        <>
          <div className="tela-auth-ou">ou</div>
          <button type="button" className="btn-google" onClick={entrarComGoogle}>
            <IconeGoogle /> Continuar com Google
          </button>
          <p className="tela-auth-rodape">
            {produtor
              ? <>É do escritório? <Link href="/login?site=assistencia">Entrar no painel</Link>.</>
              : <>É produtor? <Link href="/login?site=assistencia&como=produtor">Entrar na sua lavoura</Link>. · Só quer ver? <Link href="/demo">abrir a vitrine</Link>.</>}
          </p>
        </>
      ) : (
        <p className="tela-auth-rodape">
          Ainda não tem acesso? Peça ao seu técnico ou ao escritório que cuida da sua assistência.
        </p>
      )}
    </TelaAuth>
  );
}

export default function PaginaDeLogin() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
