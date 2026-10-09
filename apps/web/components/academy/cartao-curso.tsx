import Link from 'next/link';
import { ROTULO_NIVEL } from '@/lib/academy';
import { formatarCarga, type ProgressoDoCurso } from '@/lib/academy-cursos';
import type { CursoResumo } from '@/lib/academy-dados';
import { BarraProgresso } from './barra-progresso';
import { CapaCurso } from './capa-curso';

/** Cartão de curso do catálogo e dos carrosséis. Mostra o progresso de quem já começou. */
export function CartaoCurso({
  curso, progresso, indicado = false, href,
}: {
  curso: CursoResumo;
  progresso?: ProgressoDoCurso | null;
  indicado?: boolean;
  href?: string;
}) {
  const emAndamento = progresso && progresso.feitas > 0 && !progresso.concluido;
  return (
    <Link className="ac-cartao" href={href ?? `/academy/cursos/${curso.id}`}>
      <div className="ac-cartao-capa">
        <CapaCurso tema={curso.tema} titulo={curso.titulo} capaUrl={curso.capa_url} />
        <span className="ac-selo">{ROTULO_NIVEL[curso.nivel]}</span>
        {progresso?.concluido ? <span className="ac-selo ac-selo-ok">Concluído</span> : indicado ? <span className="ac-selo ac-selo-destaque">Indicado para você</span> : null}
      </div>
      <div className="ac-cartao-corpo">
        <h3>{curso.titulo}</h3>
        {curso.resumo ? <p>{curso.resumo}</p> : null}
        <small>
          {curso.aulas.length} {curso.aulas.length === 1 ? 'aula' : 'aulas'}
          {curso.carga_min > 0 ? ` · ${formatarCarga(curso.carga_min)}` : ''}
          {curso.cultura ? ` · ${curso.cultura}` : ''}
        </small>
        {emAndamento ? (
          <div className="ac-cartao-progresso">
            <BarraProgresso percentual={progresso.percentual} />
            <small>{progresso.percentual}% concluído</small>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
