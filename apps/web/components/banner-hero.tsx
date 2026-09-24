import type { ReactNode } from 'react';

/**
 * Banner decorativo — substitui CabecalhoVista nas telas de maior uso
 * (Sub-fase E do redesign). Sem foto de banco de imagem de propósito
 * (sem licença pra usar uma real): o "fundo" é um padrão SVG próprio, na
 * paleta da marca, evocando linhas de talhão — não uma imagem genérica.
 */
export function BannerHero({
  olho, titulo, descricao, acoes, tags,
}: {
  olho: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  tags?: string[];
}) {
  return (
    <div className="banner-hero">
      <svg className="banner-hero-padrao" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="banner-linhas" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
            <line x1="0" y1="0" x2="0" y2="46" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#banner-linhas)" />
      </svg>
      <div className="banner-hero-corpo">
        <div>
          <span className="olho">{olho}</span>
          <h1>{titulo}</h1>
          {descricao ? <p>{descricao}</p> : null}
          {acoes ? <div className="banner-hero-acoes" style={{ marginTop: 14 }}>{acoes}</div> : null}
        </div>
        {tags && tags.length > 0 && (
          <div className="banner-hero-tags">
            {tags.map((t) => <span key={t}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
