import type { ComponentType, ReactNode, SVGProps } from 'react';

/** Primitivas visuais compartilhadas. Presentacionais, sem estado. */

export function Olho({ children }: { children: ReactNode }) {
  return <span className="olho">{children}</span>;
}

export function CabecalhoVista({
  olho, titulo, descricao, acoes,
}: {
  olho: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="cabecalho-vista">
      <div>
        <Olho>{olho}</Olho>
        <h1>{titulo}</h1>
        {descricao ? <p>{descricao}</p> : null}
      </div>
      {acoes ? <div className="acoes">{acoes}</div> : null}
    </div>
  );
}

export function Cartao({
  olho, titulo, children, className = '', style,
}: {
  olho?: string;
  titulo?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`cartao ${className}`} style={style}>
      {olho ? <Olho>{olho}</Olho> : null}
      {titulo ? <h2>{titulo}</h2> : null}
      {children}
    </div>
  );
}

export function Grade({
  cols = 3, children, style,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <div className={`grade g${cols}`} style={style}>{children}</div>;
}

export function Metrica({
  rotulo, valor, detalhe, cor, icone: Icone, tendencia,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  detalhe?: ReactNode;
  cor?: string;
  /** Opcional — badge de ícone no canto (reaproveita components/icones.tsx). */
  icone?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Opcional — só passe quando houver histórico real pra comparar; nunca inventar número. */
  tendencia?: { pct: number; rotulo: string };
}) {
  return (
    <div className="metrica" data-rico={Icone ? 'true' : undefined}>
      {Icone ? <span className="metrica-icone"><Icone width={18} height={18} /></span> : null}
      <span>{rotulo}</span>
      <b style={cor ? { color: cor } : undefined}>{valor}</b>
      {detalhe ? <em>{detalhe}</em> : null}
      {tendencia ? (
        <span className="metrica-tendencia" data-sentido={tendencia.pct >= 0 ? 'alta' : 'baixa'}>
          {tendencia.pct >= 0 ? '↑' : '↓'} {Math.abs(tendencia.pct)}% {tendencia.rotulo}
        </span>
      ) : null}
    </div>
  );
}

export function Tag({
  tom = 'ok', children,
}: {
  tom?: 'ok' | 'cinza' | 'alerta' | 'ruim';
  children: ReactNode;
}) {
  const cls = tom === 'ok' ? '' : tom;
  return <span className={`tag ${cls}`}>{children}</span>;
}

export function Vazio({
  titulo, children, style,
}: {
  titulo: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="vazio" style={style}>
      <b>{titulo}</b>
      {children}
    </div>
  );
}
