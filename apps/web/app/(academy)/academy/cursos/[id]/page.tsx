import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarCurso } from '@/lib/academy-dados';
import { ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO } from '@/lib/academy';
import { formatarCarga, progressoDoCurso, proximaAula } from '@/lib/academy-cursos';
import { BarraProgresso } from '@/components/academy/barra-progresso';
import { CapaCurso } from '@/components/academy/capa-curso';
import { dataBR } from '@/lib/formato';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface IndicacaoDoCurso { id: string; mensagem: string | null; aberto_em: string | null }
const SIMBOLO = { video: '▶', artigo: '¶', material: '◫', noticia: '◉' } as const;

export default async function PaginaDoCurso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { sb, ehAluno } = await exigirConta('academy');
  const curso = await carregarCurso(sb, id);
  if (!curso) notFound();

  // o que é do aluno: matrícula, progresso nas aulas deste curso, certificado e a indicação (se houver)
  let concluidos = new Set<string>();
  let matriculado = false;
  let matriculaConcluida = false;
  let certificadoId: string | null = null;
  let indicacao: IndicacaoDoCurso | null = null;
  if (ehAluno) {
    const ids = curso.aulas.map((a) => a.conteudo_id);
    const [{ data: prog }, { data: mat }, { data: cert }, { data: ind }] = await Promise.all([
      ids.length ? sb.schema('agro').from('academy_progresso').select('conteudo_id').in('conteudo_id', ids).not('concluido_em', 'is', null) : Promise.resolve({ data: [] }),
      sb.schema('agro').from('academy_matriculas').select('concluido_em').eq('curso_id', id).maybeSingle(),
      sb.schema('agro').from('academy_certificados').select('id').eq('curso_id', id).maybeSingle(),
      sb.schema('agro').from('academy_indicacoes').select('id, mensagem, aberto_em').eq('curso_id', id).maybeSingle(),
    ]);
    concluidos = new Set(((prog ?? []) as Array<{ conteudo_id: string }>).map((p) => p.conteudo_id));
    matriculado = Boolean(mat);
    matriculaConcluida = Boolean((mat as { concluido_em: string | null } | null)?.concluido_em);
    certificadoId = (cert as { id: string } | null)?.id ?? null;
    indicacao = (ind as IndicacaoDoCurso | null) ?? null;
    // abrir a página de um curso indicado conta como "abriu" para o agrônomo acompanhar (o banco grava a hora)
    if (indicacao && !indicacao.aberto_em) {
      await sb.schema('agro').from('academy_indicacoes').update({ aberto_em: new Date().toISOString() }).eq('id', indicacao.id);
    }
  }

  const p = progressoDoCurso(curso.aulas, concluidos);
  const prox = proximaAula(curso.aulas, concluidos);
  const primeira = curso.aulas[0] ?? null;
  const destino = prox ?? primeira;
  const hrefAula = (conteudoId: string) => `/academy/aula/${conteudoId}?curso=${curso.id}`;
  const comecou = p.feitas > 0 || matriculado;

  return (
    <>
      <section className="ac-curso-topo">
        <div className="ac-curso-topo-interno">
          <div>
            <div className="ac-migalha"><Link href="/academy">Início</Link> / <Link href="/academy/cursos">Cursos</Link></div>
            <h1>{curso.titulo}</h1>
            {curso.resumo ? <p>{curso.resumo}</p> : null}
            <div className="ac-fatos">
              <span><b>{ROTULO_NIVEL[curso.nivel]}</b></span>
              {curso.tema ? <span>{ROTULO_TEMA[curso.tema]}</span> : null}
              {curso.cultura ? <span>{curso.cultura}</span> : null}
              <span><b>{curso.aulas.length}</b> {curso.aulas.length === 1 ? 'aula' : 'aulas'}</span>
              {curso.carga_min > 0 ? <span>Carga prevista <b>{formatarCarga(curso.carga_min)}</b></span> : null}
            </div>
            {ehAluno && comecou ? (
              <div style={{ maxWidth: 420, marginBottom: 18 }}>
                <BarraProgresso percentual={p.percentual} />
                <small style={{ color: '#f1dfb8' }}>{p.feitas} de {p.total} aulas concluídas ({p.percentual}%)</small>
              </div>
            ) : null}
            <div className="ac-hero-acoes">
              {destino ? (
                <Link className="ac-btn ac-btn-ouro" href={hrefAula(destino.conteudo_id)}>
                  {p.concluido ? 'Rever o curso' : comecou ? 'Continuar o curso' : 'Começar o curso'}
                </Link>
              ) : null}
              {certificadoId ? <Link className="ac-btn ac-btn-claro" href={`/academy/certificados/${certificadoId}`}>Ver meu certificado</Link> : null}
            </div>
          </div>
          <CapaCurso tema={curso.tema} titulo={curso.titulo} capaUrl={curso.capa_url} />
        </div>
      </section>

      <div className="ac-curso-corpo">
        <div>
          {!ehAluno ? (
            <div className="ac-aviso-previa">
              Você está vendo este curso como o aluno vê. O progresso e o certificado só são gravados para produtores. Para editar, use o <Link href="/academy/estudio/cursos">Estúdio</Link>.
            </div>
          ) : null}
          {indicacao ? (
            <div className="ac-aviso-previa">
              <b>Indicado pelo seu agrônomo.</b>{indicacao.mensagem ? <> “{indicacao.mensagem}”</> : null}
            </div>
          ) : null}
          {matriculaConcluida && certificadoId ? (
            <div className="ac-aviso-previa" style={{ background: 'var(--ac-ok-claro)', borderColor: '#b9dfc7', color: '#1d4d31' }}>
              <b>Curso concluído!</b> Seu certificado de participação já está disponível. <Link href={`/academy/certificados/${certificadoId}`}>Abrir certificado</Link>.
            </div>
          ) : null}

          {curso.descricao ? (
            <div className="ac-bloco">
              <h2>Sobre este curso</h2>
              <p>{curso.descricao}</p>
            </div>
          ) : null}

          <div className="ac-bloco">
            <h2>Conteúdo do curso</h2>
            {curso.estrutura.length === 0 ? <p>Este curso ainda não tem aulas.</p> : curso.estrutura.map((m, i) => (
              <details className="ac-modulo" key={m.id} open={i === 0 || m.aulas.some((a) => a.conteudo_id === prox?.conteudo_id)}>
                <summary>
                  <span>{m.titulo}</span>
                  <small>{m.aulas.length} {m.aulas.length === 1 ? 'aula' : 'aulas'}</small>
                </summary>
                <ul className="ac-linhas">
                  {m.aulas.map((a) => {
                    const feita = concluidos.has(a.conteudo_id);
                    return (
                      <li key={a.id}>
                        <Link className="ac-linha" href={hrefAula(a.conteudo_id)} data-feita={feita} data-atual={prox?.conteudo_id === a.conteudo_id}>
                          <span className="ac-linha-marca" aria-hidden="true">{feita ? '✓' : ''}</span>
                          <b>{a.titulo}</b>
                          <small>{ROTULO_TIPO[a.tipo]} {SIMBOLO[a.tipo]}{a.duracao_min ? ` · ${formatarCarga(a.duracao_min)}` : ''}</small>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        </div>

        <aside className="ac-lateral">
          <div className="ac-bloco">
            <h2>Este curso inclui</h2>
            <ul>
              <li><span>▶</span> {curso.aulas.length} {curso.aulas.length === 1 ? 'aula' : 'aulas'} em {curso.estrutura.length} {curso.estrutura.length === 1 ? 'módulo' : 'módulos'}</li>
              {curso.carga_min > 0 ? <li><span>◷</span> Carga horária prevista de {formatarCarga(curso.carga_min)}</li> : null}
              <li><span>◆</span> Nível {ROTULO_NIVEL[curso.nivel].toLowerCase()}</li>
              {curso.certificado ? <li><span>✓</span> Certificado de participação ao concluir todas as aulas</li> : <li><span>–</span> Sem certificado</li>}
              <li><span>◎</span> No celular ou no computador, no seu ritmo</li>
            </ul>
            {destino ? (
              <Link className="ac-btn ac-btn-escuro" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} href={hrefAula(destino.conteudo_id)}>
                {p.concluido ? 'Rever o curso' : comecou ? 'Continuar' : 'Começar agora'}
              </Link>
            ) : null}
            {curso.publicado_em ? <small style={{ display: 'block', marginTop: 12, color: 'var(--grafite-2)' }}>Publicado em {dataBR(curso.publicado_em)}{curso.revisado_em ? ` · revisado em ${dataBR(curso.revisado_em)}` : ''}</small> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
