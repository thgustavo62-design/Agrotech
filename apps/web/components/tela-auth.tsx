import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { LogoIcone } from '@/components/logo';
import type { SiteId } from '@/lib/sites';

export interface RecursoAuth {
  icone: ReactNode;
  titulo: string;
  descricao: string;
}

/**
 * Vitrine de autenticação (login/cadastro): foto da lavoura em tela cheia, texto da marca à esquerda, cartões de vidro no
 * meio (só enfeite — o que o site oferece) e o cartão do formulário à direita, sobre uma cunha diagonal. Cada site troca foto,
 * cores e cartões (CSS `data-site`). Abaixo de 1240px o enfeite do meio some; abaixo de 880px sobra só o cartão — tela de
 * entrar não precisa de decoração no celular.
 */
export function TelaAuth({
  imagem, tagline, eyebrow, headline, descricao, recursos, abas, titulo, legenda, children, site = 'assistencia', seletor, flutuantes, logoNoCartao, produtor,
}: {
  imagem: string;
  /** nome do site, em letras espaçadas sob o logotipo */
  tagline: string;
  /** frase curta acima do título */
  eyebrow?: string;
  headline: ReactNode;
  descricao: string;
  recursos: RecursoAuth[];
  abas?: { entrarHref: string; criarHref: string; ativa: 'entrar' | 'criar' };
  titulo: string;
  legenda?: string;
  children: ReactNode;
  /** cada site tem as próprias cores (CSS `data-site`) */
  site?: SiteId;
  /** escolha do site, no topo do cartão */
  seletor?: ReactNode;
  /** cartões de vidro do meio da tela */
  flutuantes?: ReactNode;
  /** logotipo do site no topo do cartão (o Connect só o mostra à esquerda) */
  logoNoCartao?: boolean;
  produtor?: boolean;
}) {
  const rotuloDoCartao = tagline.split('·')[0]!.trim();
  return (
    <div className="tela-auth" data-site={site} data-produtor={produtor ? 'true' : undefined} style={{ ['--auth-foto' as string]: `url(${imagem})` } as CSSProperties}>
      <div className="tela-auth-cunha" aria-hidden="true" />
      <div className="tela-auth-foto">
        <div className="tela-auth-marca">
          <LogoIcone tamanho={50} />
          <div>
            <b>AgroTech</b>
            <span>{tagline}</span>
          </div>
        </div>
        {eyebrow ? <p className="tela-auth-eyebrow">{eyebrow}</p> : null}
        <div className="tela-auth-corpo">
          <h1>{headline}</h1>
          <p>{descricao}</p>
          <div className="tela-auth-recursos">
            {recursos.map((r) => (
              <div className="recurso-auth" key={r.titulo}>
                <div className="recurso-auth-icone">{r.icone}</div>
                <div>
                  <b>{r.titulo}</b>
                  <p>{r.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {flutuantes ? <div className="tela-auth-flutuantes" aria-hidden="true">{flutuantes}</div> : null}
      <div className="tela-auth-lado">
        <div className="tela-auth-cartao">
          {logoNoCartao ? (
            <div className="tela-auth-logo-cartao">
              <LogoIcone tamanho={44} />
              <div>
                <b>AgroTech</b>
                <span>{rotuloDoCartao}</span>
              </div>
            </div>
          ) : null}
          {seletor}
          {abas ? (
            <div className="tela-auth-abas">
              <Link href={abas.entrarHref} className="tela-auth-aba" data-ativa={abas.ativa === 'entrar'}>Entrar</Link>
              <Link href={abas.criarHref} className="tela-auth-aba" data-ativa={abas.ativa === 'criar'}>Criar conta</Link>
            </div>
          ) : null}
          <h1>{titulo}</h1>
          {legenda ? <p className="legenda">{legenda}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cartão de vidro do meio da tela. `posicao` escolhe o canto (CSS .fl-1/.fl-2/.fl-3). */
export function CartaoFlutuante({ posicao, icone, titulo, texto }: { posicao: 1 | 2 | 3; icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className={`fl fl-${posicao}`}>
      <span className="fl-icone">{icone}</span>
      <div><b>{titulo}</b><small>{texto}</small></div>
    </div>
  );
}

/** Foto inclinada do meio da tela. */
export function FotoFlutuante({ imagem }: { imagem: string }) {
  return <div className="fl-foto" style={{ backgroundImage: `url(${imagem})` }} />;
}

/** "Pedido recebido → Em atendimento → Retorno previsto": o andamento que o Connect mostra, como ilustração. */
export function AndamentoFlutuante({ posicao, passos }: { posicao: 1 | 2 | 3; passos: Array<{ titulo: string; texto: string; estado: 'feito' | 'agora' | 'depois' }> }) {
  return (
    <div className={`fl fl-${posicao} fl-tempo`}>
      {passos.map((p) => (
        <div key={p.titulo}>
          <span className="fl-passo" data-feito={p.estado === 'feito'} data-agora={p.estado === 'agora'}>{p.estado === 'feito' ? '✓' : ''}</span>
          <div><b>{p.titulo}</b><small>{p.texto}</small></div>
        </div>
      ))}
    </div>
  );
}
