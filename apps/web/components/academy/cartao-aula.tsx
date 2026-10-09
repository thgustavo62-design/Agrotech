import Link from 'next/link';
import { ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO, dominioDoLink } from '@/lib/academy';
import type { ConteudoResumo } from '@/lib/academy-dados';
import { formatarCarga } from '@/lib/academy-cursos';

const SIMBOLO = { video: '▶', artigo: '¶', material: '◫', noticia: '◉' } as const;

/** Aula avulsa (conteúdo fora de curso) ou notícia: cartão mais simples, sem capa grande. */
export function CartaoAula({ conteudo, concluido = false, indicado = false }: { conteudo: ConteudoResumo; concluido?: boolean; indicado?: boolean }) {
  const noticia = conteudo.tipo === 'noticia';
  return (
    <Link className="ac-aula-cartao" href={`/academy/aula/${conteudo.id}`}>
      <span className="ac-aula-icone" data-tipo={conteudo.tipo} aria-hidden="true">{SIMBOLO[conteudo.tipo]}</span>
      <div>
        <h3>{conteudo.titulo}</h3>
        <small>
          {ROTULO_TIPO[conteudo.tipo]}
          {conteudo.tema ? ` · ${ROTULO_TEMA[conteudo.tema]}` : ''}
          {!noticia ? ` · ${ROTULO_NIVEL[conteudo.nivel]}` : ''}
          {conteudo.duracao_min ? ` · ${formatarCarga(conteudo.duracao_min)}` : ''}
          {noticia && conteudo.fonte ? ` · ${conteudo.fonte}` : ''}
          {noticia && !conteudo.fonte ? ` · ${dominioDoLink(conteudo.url) ?? ''}` : ''}
        </small>
        {conteudo.descricao ? <p>{conteudo.descricao}</p> : null}
      </div>
      {concluido ? <span className="ac-selo ac-selo-ok">Concluída</span> : indicado ? <span className="ac-selo ac-selo-destaque">Indicada</span> : null}
    </Link>
  );
}
