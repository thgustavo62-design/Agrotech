import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarCurso, type CursoResumo } from '@/lib/academy-dados';
import {
  ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO, dominioDoLink, embedDeVideo, type Conteudo,
} from '@/lib/academy';
import { formatarCarga, progressoDoCurso, vizinhas } from '@/lib/academy-cursos';
import { dataBR } from '@/lib/formato';
import { BarraProgresso } from '@/components/academy/barra-progresso';
import { VideoComFachada } from '@/components/academy/video-com-fachada';
import { concluirAula } from '../../acoes';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDaAula({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ curso?: string }> }) {
  const { id } = await params;
  const { curso: cursoParam } = await searchParams;
  if (!UUID.test(id)) notFound();

  const { sb, ehAluno } = await exigirConta('academy');
  // a RLS decide: se não for publicado e para esta pessoa, a aula simplesmente não existe para ela
  const { data } = await sb.schema('agro').from('academy_conteudos').select('*').eq('id', id).eq('status', 'publicado').maybeSingle();
  if (!data) notFound();
  const c = data as unknown as Conteudo;

  // o contexto de curso só vale se a aula realmente faz parte dele
  let curso: CursoResumo | null = null;
  if (cursoParam && UUID.test(cursoParam)) {
    const k = await carregarCurso(sb, cursoParam);
    if (k && k.aulas.some((a) => a.conteudo_id === id)) curso = k;
  }

  // aluno: abrir a aula é começar (e abrir uma aula de curso é se matricular); tudo idempotente
  let concluidos = new Set<string>();
  if (ehAluno) {
    const produtor = await produtorAtual();
    if (produtor) {
      const banco = await criarClienteServidor();
      if (curso) {
        await banco.schema('agro').from('academy_matriculas').upsert({ curso_id: curso.id, produtor_id: produtor.id }, { onConflict: 'curso_id,produtor_id', ignoreDuplicates: true });
      }
      await banco.schema('agro').from('academy_progresso').upsert({ produtor_id: produtor.id, conteudo_id: id }, { onConflict: 'produtor_id,conteudo_id', ignoreDuplicates: true });
      const ids = curso ? curso.aulas.map((a) => a.conteudo_id) : [id];
      const { data: prog } = await banco.schema('agro').from('academy_progresso').select('conteudo_id').in('conteudo_id', ids).not('concluido_em', 'is', null);
      concluidos = new Set(((prog ?? []) as Array<{ conteudo_id: string }>).map((p) => p.conteudo_id));
    }
  }

  const feita = concluidos.has(id);
  const assinada = c.arquivo_path ? await sb.storage.from('academy').createSignedUrl(c.arquivo_path, 3600) : null;
  const embed = c.tipo === 'video' ? embedDeVideo(c.url) : null;
  const dominio = dominioDoLink(c.url);
  const { anterior, seguinte } = curso ? vizinhas(curso.aulas, id) : { anterior: null, seguinte: null };
  const progresso = curso ? progressoDoCurso(curso.aulas, concluidos) : null;
  const hrefAula = (conteudoId: string) => `/academy/aula/${conteudoId}?curso=${curso!.id}`;
  const ultima = Boolean(curso) && !seguinte;

  return (
    <div className={`ac-aula-grade${curso ? '' : ' ac-sem-lateral'}`}>
      <article className="ac-aula-conteudo">
        <div className="ac-migalha ac-migalha-clara">
          <Link href="/academy">Início</Link> /{' '}
          {curso ? <Link href={`/academy/cursos/${curso.id}`}>{curso.titulo}</Link> : <Link href="/academy/cursos">Cursos</Link>}
        </div>
        <h1>{c.titulo}</h1>
        <div className="ac-aula-meta">
          <span>{ROTULO_TIPO[c.tipo]}</span>
          {c.tema ? <span>{ROTULO_TEMA[c.tema]}</span> : null}
          {c.cultura ? <span>{c.cultura}</span> : null}
          {c.tipo !== 'noticia' ? <span>{ROTULO_NIVEL[c.nivel]}</span> : null}
          {c.duracao_min ? <span>{formatarCarga(c.duracao_min)}</span> : null}
          {c.fonte ? <span>Fonte: {c.fonte}</span> : null}
          {c.tipo === 'noticia' && c.data_materia ? <span>Matéria de {dataBR(c.data_materia)}</span> : null}
          {c.tipo === 'noticia' && c.regiao ? <span>{c.regiao}</span> : null}
        </div>

        {!ehAluno ? (
          <div className="ac-aviso-previa">Você está vendo esta aula como o aluno vê. O progresso só é gravado para produtores.</div>
        ) : null}

        {c.tipo === 'video' && c.url ? (
          embed ? (
            <VideoComFachada embed={embed.embed} provedor={embed.provedor} titulo={c.titulo} linkOriginal={c.url} />
          ) : (
            <p><a className="ac-btn ac-btn-escuro" href={c.url} target="_blank" rel="noopener noreferrer">Assistir ao vídeo</a>{' '}
              <small className="nota">abre em outra aba{dominio ? ` (${dominio})` : ''}</small></p>
          )
        ) : null}

        {c.descricao && c.tipo !== 'noticia' ? <p style={{ fontSize: 16, lineHeight: 1.65, color: '#3b2f1f' }}>{c.descricao}</p> : null}

        {c.tipo === 'artigo' && c.corpo ? <div className="ac-leitura"><div className="conteudo-corpo">{c.corpo}</div></div> : null}

        {c.tipo === 'material' ? (
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {assinada?.data?.signedUrl ? <a className="ac-btn ac-btn-escuro" href={assinada.data.signedUrl} target="_blank" rel="noopener noreferrer">Abrir o material</a> : null}
            {c.url ? <a className="ac-btn ac-btn-claro" style={{ color: 'var(--folha) !important', borderColor: 'var(--folha)' }} href={c.url} target="_blank" rel="noopener noreferrer">Abrir o link{dominio ? ` (${dominio})` : ''}</a> : null}
          </p>
        ) : null}

        {c.tipo === 'noticia' ? (
          <div className="ac-leitura">
            {c.descricao ? <p style={{ fontSize: 17, lineHeight: 1.7, margin: '0 0 14px' }}>{c.descricao}</p> : null}
            <p className="nota" style={{ margin: '0 0 14px' }}>Resumo escrito pelo escritório. A matéria completa é de {c.fonte ?? dominio ?? 'outro site'}, e os direitos pertencem a ela.</p>
            {c.url ? <a className="ac-btn ac-btn-escuro" href={c.url} target="_blank" rel="noopener noreferrer">Ler a matéria original{dominio ? ` (${dominio})` : ''}</a> : null}
          </div>
        ) : null}

        <div className="ac-acao-aula">
          {ehAluno ? (
            feita ? (
              <span className="tag">✓ Aula concluída</span>
            ) : (
              <form action={concluirAula}>
                <input type="hidden" name="conteudo_id" value={c.id} />
                {curso ? <input type="hidden" name="curso_id" value={curso.id} /> : null}
                <button className="ac-btn ac-btn-ouro" type="submit">{curso ? (ultima ? 'Concluir o curso' : 'Concluir e ir para a próxima') : 'Marcar como concluída'}</button>
              </form>
            )
          ) : null}
          {curso && anterior ? <Link className="btn sec" href={hrefAula(anterior.conteudo_id)}>← Aula anterior</Link> : null}
          {curso && seguinte && (feita || !ehAluno) ? <Link className="btn sec" href={hrefAula(seguinte.conteudo_id)}>Próxima aula →</Link> : null}
          {curso && ultima && feita ? <Link className="btn sec" href={`/academy/cursos/${curso.id}`}>Voltar ao curso</Link> : null}
          {!curso ? <Link className="btn sec" href="/academy/cursos">Ver cursos</Link> : null}
        </div>
      </article>

      {curso ? (
        <aside className="ac-roteiro" aria-label="Aulas do curso">
          <div className="ac-roteiro-topo">
            <b>{curso.titulo}</b>
            {ehAluno && progresso ? (
              <>
                <BarraProgresso percentual={progresso.percentual} />
                <small style={{ color: 'var(--grafite)' }}>{progresso.feitas} de {progresso.total} aulas ({progresso.percentual}%)</small>
              </>
            ) : <small style={{ color: 'var(--grafite)' }}>{curso.aulas.length} aulas</small>}
          </div>
          <div className="ac-roteiro-lista">
            {curso.estrutura.map((m) => (
              <details className="ac-modulo" key={m.id} open={m.aulas.some((a) => a.conteudo_id === id)}>
                <summary><span>{m.titulo}</span><small>{m.aulas.length}</small></summary>
                <ul className="ac-linhas">
                  {m.aulas.map((a) => (
                    <li key={a.id}>
                      <Link className="ac-linha" href={hrefAula(a.conteudo_id)} data-feita={concluidos.has(a.conteudo_id)} data-atual={a.conteudo_id === id} aria-current={a.conteudo_id === id ? 'page' : undefined}>
                        <span className="ac-linha-marca" aria-hidden="true">{concluidos.has(a.conteudo_id) ? '✓' : ''}</span>
                        <b>{a.titulo}</b>
                        {a.duracao_min ? <small>{formatarCarga(a.duracao_min)}</small> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
