import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { formatarCarga } from '@/lib/academy-cursos';

export const dynamic = 'force-dynamic';

interface Matricula {
  id: string; curso_id: string; produtor_id: string; criado_em: string; concluido_em: string | null;
  produtor: { nome: string } | null; curso: { titulo: string } | null;
}

export default async function VisaoGeralDoEstudio() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');

  const [{ data: cursos }, { data: conteudos }, { data: mats }, { data: certs }, { data: prog }, { data: aulas }] = await Promise.all([
    sb.schema('agro').from('academy_cursos').select('id, status'),
    sb.schema('agro').from('academy_conteudos').select('id, status, duracao_min'),
    sb.schema('agro').from('academy_matriculas')
      .select('id, curso_id, produtor_id, criado_em, concluido_em, produtor:produtor_id(nome), curso:curso_id(titulo)').order('criado_em', { ascending: false }).limit(200),
    sb.schema('agro').from('academy_certificados').select('id'),
    sb.schema('agro').from('academy_progresso').select('produtor_id, conteudo_id, concluido_em'),
    sb.schema('agro').from('academy_curso_aulas').select('curso_id, conteudo_id'),
  ]);

  const cs = (cursos ?? []) as Array<{ id: string; status: string }>;
  const ct = (conteudos ?? []) as Array<{ id: string; status: string; duracao_min: number | null }>;
  const matriculas = (mats ?? []) as unknown as Matricula[];
  const progresso = (prog ?? []) as Array<{ produtor_id: string; conteudo_id: string; concluido_em: string | null }>;
  const aulasPorCurso = new Map<string, string[]>();
  for (const a of (aulas ?? []) as Array<{ curso_id: string; conteudo_id: string }>) aulasPorCurso.set(a.curso_id, [...(aulasPorCurso.get(a.curso_id) ?? []), a.conteudo_id]);
  const feitas = (produtor: string, curso: string) => {
    const ids = new Set(aulasPorCurso.get(curso) ?? []);
    return progresso.filter((p) => p.produtor_id === produtor && p.concluido_em && ids.has(p.conteudo_id)).length;
  };

  const publicados = cs.filter((c) => c.status === 'publicado').length;
  const rascunhos = cs.filter((c) => c.status === 'rascunho').length;
  const concluidas = matriculas.filter((m) => m.concluido_em).length;
  const horas = ct.filter((c) => c.status === 'publicado').reduce((s, c) => s + (c.duracao_min ?? 0), 0);

  return (
    <>
      <CabecalhoVista
        olho="Estúdio"
        titulo="Visão geral da Academy"
        descricao="Monte cursos com os seus conteúdos, indique aos produtores e acompanhe quem está aprendendo."
        acoes={podeEditar ? <Link className="btn verde" href="/academy/estudio/cursos/novo">Novo curso</Link> : undefined}
      />

      <Grade cols={4} style={{ marginBottom: 14 }}>
        <Metrica rotulo="Cursos publicados" valor={publicados} />
        <Metrica rotulo="Cursos em rascunho" valor={rascunhos} cor={rascunhos ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Conteúdos publicados" valor={ct.filter((c) => c.status === 'publicado').length} detalhe={horas > 0 ? `${formatarCarga(horas)} de conteúdo` : undefined} />
        <Metrica rotulo="Certificados emitidos" valor={(certs ?? []).length} detalhe={`${concluidas} matrícula(s) concluída(s)`} />
      </Grade>

      <Cartao olho="Acompanhamento" titulo="Quem está aprendendo">
        {matriculas.length === 0 ? (
          <Vazio titulo="Ninguém começou um curso ainda">
            Quando um produtor abrir a primeira aula de um curso, ele aparece aqui com o andamento. Indique um curso para dar o primeiro empurrão.
          </Vazio>
        ) : (
          <div className="lista">
            {matriculas.slice(0, 30).map((m) => {
              const total = (aulasPorCurso.get(m.curso_id) ?? []).length;
              const f = feitas(m.produtor_id, m.curso_id);
              return (
                <div className="item" key={m.id}>
                  <div className="cresce">
                    <h3>{m.produtor?.nome ?? 'Produtor'}</h3>
                    <small>{m.curso?.titulo ?? 'Curso'} · começou em {dataBR(m.criado_em)} · {f} de {total} aulas</small>
                  </div>
                  {m.concluido_em ? <Tag tom="ok">concluiu em {dataBR(m.concluido_em)}</Tag> : <Tag tom="alerta">em andamento</Tag>}
                  <Link className="btn sec mini" href={`/academy/estudio/cursos/${m.curso_id}#alunos`}>ver curso</Link>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
