import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogoIcone } from '@/components/logo';

export interface RecursoAuth {
  icone: ReactNode;
  titulo: string;
  descricao: string;
}

/**
 * Vitrine de autenticação (login/cadastro) — foto real (Pexels, licença
 * comercial livre) com gradiente da marca à esquerda + cartão de formulário
 * à direita. Abaixo de 880px a foto some (components/globals.css .tela-auth),
 * fica só o cartão — tela de entrar não precisa de decoração no celular.
 */
export function TelaAuth({
  imagem, tagline, headline, descricao, recursos, abas, titulo, legenda, children,
}: {
  imagem: string;
  tagline: string;
  headline: ReactNode;
  descricao: string;
  recursos: RecursoAuth[];
  abas?: { entrarHref: string; criarHref: string; ativa: 'entrar' | 'criar' };
  titulo: string;
  legenda?: string;
  children: ReactNode;
}) {
  return (
    <div className="tela-auth">
      <div
        className="tela-auth-foto"
        style={{
          backgroundImage: `linear-gradient(160deg, rgba(6,26,18,.55) 0%, rgba(8,34,24,.72) 45%, rgba(6,26,18,.93) 100%), url(${imagem})`,
        }}
      >
        <div className="tela-auth-marca">
          <LogoIcone tamanho={38} />
          <div>
            <b>AgroTech</b>
            <span>{tagline}</span>
          </div>
        </div>
        <hr className="tela-auth-risco" />
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
      <div className="tela-auth-lado">
        <div className="tela-auth-cartao">
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
