import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca, indicesPorId } from '@/lib/academy-dados';
import { progressoDoCurso, proximaAula } from '@/lib/academy-cursos';
import { dataBR } from '@/lib/formato';
import { CartaoAula } from '@/components/academy/cartao-aula';
import { CartaoCurso } from '@/components/academy/cartao-curso';

export const dynamic = 'force-dynamic';

type Aba = 'andamento' | 'concluidos' | 'indicados';
const ABAS: Array<{ id: Aba; rotulo: string }> = [
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'concluidos', rotulo: 'Concluídos e certificados' },
  { id: 'indicados', rotulo: 'Indicados para mim' },
];

export default async function MeusCursos({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba: abaParam } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === abaParam) ? (abaParam as Aba) : 'andamento';
  const { sb, ehAluno } = await exigirConta('academy');

  if (!ehAluno) {
    return (
      <main className="ac-principal">
        <h1 className="ac-titulo-pagina">Meus cursos</h1>
        <div className="ac-vazio">
          <b>Esta área é dos alunos</b>
          O progresso, os certificados e as indicações são dos produtores. Para ver como o aluno vê, abra o <Link href="/academy/cursos">catálogo</Link>; para acompanhar os alunos, use o <Link href="/academy/estudio">Estúdio</Link>.
        </div>
      </main>
    );
  }

  const bib = await carregarBiblioteca(sb, true);
  const cursosPorId = indicesPorId(bib.cursos);
  const conteudosPorId = indicesPorId(bib.conteudos);
  const matriculados = bib.cursos.filter((c) => bib.matriculas.has(c.id));
  const emAndamento = matriculados.filter((c) => !bib.matriculas.get(c.id)!.concluido_em);
  const concluidos = matriculados.filter((c) => bib.matriculas.get(c.id)!.concluido_em);
  const indicados = bib.indicacoes.filter((i) => !i.concluido_em);
  const contagem: Record<Aba, number> = { andamento: emAndamento.length, concluidos: concluidos.length, indicados: indicados.length };

  return (
    <main className="ac-principal">
      <h1 className="ac-titulo-pagina">Meus cursos</h1>
      <p className="ac-subtitulo">Seu caminho na Academy: o que você está fazendo, o que já concluiu e o que o seu agrônomo indicou.</p>

      <nav className="ac-abas" aria-label="Meus cursos">
        {ABAS.map((a) => (
          <Link key={a.id} href={`/academy/meus-cursos?aba=${a.id}`} data-ativa={aba === a.id} aria-current={aba === a.id ? 'page' : undefined}>
            {a.rotulo}{contagem[a.id] > 0 ? ` (${contagem[a.id]})` : ''}
          </Link>
        ))}
      </nav>

      {aba === 'andamento' ? (
        emAndamento.length === 0 ? (
          <div className="ac-vazio">
            <b>Você não tem curso em andamento</b>
            Escolha um curso no <Link href="/academy/cursos">catálogo</Link> e comece pela primeira aula.
          </div>
        ) : (
          <div className="ac-grade">
            {emAndamento.map((c) => {
              const prox = proximaAula(c.aulas, bib.concluidos);
              return <CartaoCurso key={c.id} curso={c} progresso={progressoDoCurso(c.aulas, bib.concluidos)} href={prox ? `/academy/aula/${prox.conteudo_id}?curso=${c.id}` : undefined} />;
            })}
          </div>
        )
      ) : null}

      {aba === 'concluidos' ? (
        concluidos.length === 0 ? (
          <div className="ac-vazio"><b>Nenhum curso concluído ainda</b>Ao concluir todas as aulas de um curso, o certificado de participação aparece aqui.</div>
        ) : (
          <div className="ac-grade">
            {concluidos.map((c) => {
              const cert = bib.certificados.get(c.id);
              return (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CartaoCurso curso={c} progresso={progressoDoCurso(c.aulas, bib.concluidos)} />
                  <small style={{ color: 'var(--grafite)' }}>Concluído em {dataBR(bib.matriculas.get(c.id)!.concluido_em)}</small>
                  {cert ? <Link className="btn verde" href={`/academy/certificados/${cert}`}>Ver certificado</Link> : <small style={{ color: 'var(--grafite-2)' }}>Este curso não emite certificado.</small>}
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {aba === 'indicados' ? (
        indicados.length === 0 ? (
          <div className="ac-vazio"><b>Nada indicado no momento</b>Quando o seu agrônomo indicar um curso ou uma aula, ela aparece aqui e você recebe um aviso.</div>
        ) : (
          <div className="ac-aulas">
            {indicados.map((i) => {
              const curso = i.curso_id ? cursosPorId.get(i.curso_id) : null;
              const conteudo = i.conteudo_id ? conteudosPorId.get(i.conteudo_id) : null;
              return (
                <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {curso ? <CartaoCurso curso={curso} progresso={progressoDoCurso(curso.aulas, bib.concluidos)} indicado /> : conteudo ? <CartaoAula conteudo={conteudo} indicado /> : null}
                  {i.mensagem ? <p className="nota" style={{ margin: 0 }}>Recado: “{i.mensagem}”</p> : null}
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </main>
  );
}
