import { capaDoTema, fundoDaCapa, iniciais } from '@/lib/academy-cursos';
import type { Tema } from '@/lib/academy';

/** Capa do curso: a foto enviada pelo escritório ou, sem ela, uma capa pela cor e pelo símbolo do tema. */
export function CapaCurso({ tema, titulo, capaUrl, className = '' }: { tema: Tema | null; titulo: string; capaUrl?: string | null; className?: string }) {
  const c = capaDoTema(tema);
  return (
    <div
      className={`ac-capa ${className}`}
      style={capaUrl ? { backgroundImage: `url(${capaUrl})` } : { background: fundoDaCapa(tema) }}
      role="img"
      aria-label={`Capa do curso ${titulo}`}
    >
      {capaUrl ? null : (
        <>
          <span className="ac-capa-simbolo" aria-hidden="true">{c.simbolo}</span>
          <span className="ac-capa-iniciais" aria-hidden="true">{iniciais(titulo)}</span>
        </>
      )}
    </div>
  );
}
