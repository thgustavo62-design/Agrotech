import type { ReactNode } from 'react';

/**
 * Banner decorativo — substitui CabecalhoVista nas telas de maior uso
 * (Sub-fase E do redesign). Usa foto real (Pexels, licença comercial livre,
 * sem exigência de crédito) com gradiente da marca por cima; cai no padrão
 * SVG próprio (linhas evocando talhão) quando nenhuma imagem é passada.
 */
/** Fotos licenciadas (Pexels — uso comercial livre, sem exigência de crédito) em public/banners. */
export const FOTO_CONSULTOR = '/banners/campo-aereo.jpg';
export const FOTO_PRODUTOR = '/banners/vale-verde.jpg';
export const FOTO_CAFE = '/banners/cafe-cereja.jpg';

export function BannerHero({
  olho, titulo, descricao, acoes, tags, imagem,
}: {
  olho: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  tags?: string[];
  /** Caminho de uma foto em public/banners — quando ausente, cai no padrão SVG decorativo. */
  imagem?: string;
}) {
  const estiloFoto = imagem ? {
    backgroundImage: `linear-gradient(135deg, rgba(11,72,52,.90) 0%, rgba(15,92,67,.84) 55%, rgba(26,122,90,.72) 100%), url(${imagem})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : undefined;

  return (
    <div className="banner-hero" style={estiloFoto}>
      {!imagem && (
        <svg className="banner-hero-padrao" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="banner-linhas" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
              <line x1="0" y1="0" x2="0" y2="46" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#banner-linhas)" />
        </svg>
      )}
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
