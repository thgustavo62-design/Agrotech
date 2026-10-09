import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';
import { ROTULO_NIVEL, ROTULO_STATUS, ROTULO_TEMA, type StatusConteudo } from '@/lib/academy';
import { formatarCarga, type Curso } from '@/lib/academy-cursos';

export const dynamic = 'force-dynamic';

export default async function CursosDoEstudio() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');

  const [{ data }, { data: aulas }, { data: mats }] = await Promise.all([
    sb.schema('agro').from('academy_cursos')
      .select('id, titulo, resumo, descricao, cultura, tema, nivel, capa_path, destaque, certificado, status, visibilidade, publicado_em, revisado_em, atualizado_em')
      .order('atualizado_em', { ascending: false }),
    sb.schema('agro').from('academy_curso_aulas').select('curso_id, conteudo:conteudo_id(duracao_min)'),
    sb.schema('agro').from('academy_matriculas').select('curso_id, concluido_em'),
  ]);
  const cursos = (data ?? []) as unknown as Array<Curso & { atualizado_em: string }>;
  const aulasPor = new Map<string, { n: number; min: number }>();
  for (const a of (aulas ?? []) as unknown as Array<{ curso_id: string; conteudo: { duracao_min: number | null } | null }>) {
    const x = aulasPor.get(a.curso_id) ?? { n: 0, min: 0 };
    x.n += 1;
    x.min += a.conteudo?.duracao_min ?? 0;
    aulasPor.set(a.curso_id, x);
  }
  const matsPor = new Map<string, { n: number; fim: number }>();
  for (const m of (mats ?? []) as Array<{ curso_id: string; concluido_em: string | null }>) {
    const x = matsPor.get(m.curso_id) ?? { n: 0, fim: 0 };
    x.n += 1;
    if (m.concluido_em) x.fim += 1;
    matsPor.set(m.curso_id, x);
  }

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Cursos"
        titulo="Cursos do escritório"
        descricao="Um curso reúne aulas (conteúdos da biblioteca) em módulos. O aluno faz no ritmo dele e, ao concluir, recebe o certificado de participação."
        acoes={podeEditar ? <Link className="btn verde" href="/academy/estudio/cursos/novo">Novo curso</Link> : undefined}
      />
      <Cartao olho={`${cursos.length} curso(s)`} titulo="Todos os cursos">
        {cursos.length === 0 ? (
          <Vazio titulo="Nenhum curso ainda">
            {podeEditar ? <>Comece criando o curso e depois adicione as aulas. <Link href="/academy/estudio/cursos/novo">Criar o primeiro curso.</Link></> : 'Quando o agrônomo criar um curso, ele aparece aqui.'}
          </Vazio>
        ) : (
          <div className="lista">
            {cursos.map((c) => {
              const s = ROTULO_STATUS[c.status as StatusConteudo];
              const a = aulasPor.get(c.id);
              const m = matsPor.get(c.id);
              return (
                <div className="item" key={c.id}>
                  <div className="cresce">
                    <h3>{c.titulo}{c.destaque ? ' ★' : ''}</h3>
                    <small>
                      {a?.n ?? 0} aula(s){a && a.min > 0 ? ` · ${formatarCarga(a.min)}` : ''} · {ROTULO_NIVEL[c.nivel]}
                      {c.tema ? ` · ${ROTULO_TEMA[c.tema]}` : ''}{c.cultura ? ` · ${c.cultura}` : ''}
                      {c.visibilidade === 'selecionados' ? ' · só selecionados' : c.visibilidade === 'cultura' ? ' · por cultura' : ''}
                      {m ? ` · ${m.n} aluno(s), ${m.fim} concluiu` : ''}
                      {` · atualizado em ${dataBR(c.atualizado_em)}`}
                    </small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                  <Link className="btn sec mini" href={`/academy/estudio/cursos/${c.id}`}>{podeEditar ? 'abrir' : 'ver'}</Link>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
