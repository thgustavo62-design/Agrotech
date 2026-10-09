import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag } from '@/components/ui';
import { ROTULO_STATUS, type StatusConteudo, type TipoConteudo } from '@/lib/academy';
import { montarEstrutura, type Curso } from '@/lib/academy-cursos';
import type { ProdutorOpcao } from '../../conteudos/secoes/FormConteudo';
import { Indicacoes, type IndicacaoLinha } from '../../conteudos/secoes/Indicacoes';
import { FormCurso } from '../secoes/FormCurso';
import { Estrutura, type ConteudoDisponivel, type ModuloLinha } from '../secoes/Estrutura';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinhaAula = { id: string; modulo_id: string; conteudo_id: string; posicao: number; conteudo: { titulo: string; tipo: TipoConteudo; status: StatusConteudo; duracao_min: number | null } | null };

export default async function CursoDoEstudio({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ indicado?: string; produtor?: string; visita?: string; analise?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();

  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const { data } = await sb.schema('agro').from('academy_cursos').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const curso = data as unknown as Curso;

  const [{ data: prod }, { data: pub }, { data: mods }, { data: aus }, { data: disp }, { data: ind }, { data: mats }, { data: certs }, assinada] = await Promise.all([
    sb.schema('agro').from('produtores').select('id, nome').order('nome'),
    sb.schema('agro').from('academy_curso_publicos').select('produtor_id').eq('curso_id', id),
    sb.schema('agro').from('academy_curso_modulos').select('id, titulo, posicao').eq('curso_id', id),
    sb.schema('agro').from('academy_curso_aulas').select('id, modulo_id, conteudo_id, posicao, conteudo:conteudo_id(titulo, tipo, status, duracao_min)').eq('curso_id', id),
    sb.schema('agro').from('academy_conteudos').select('id, titulo, tipo, duracao_min').eq('status', 'publicado').order('titulo').limit(500),
    sb.schema('agro').from('academy_indicacoes').select('id, produtor_id, mensagem, criado_em, aberto_em, concluido_em, produtor:produtor_id(nome)').eq('curso_id', id).order('criado_em', { ascending: false }),
    sb.schema('agro').from('academy_matriculas').select('produtor_id, criado_em, concluido_em, produtor:produtor_id(nome)').eq('curso_id', id).order('criado_em', { ascending: false }),
    sb.schema('agro').from('academy_certificados').select('produtor_id, codigo').eq('curso_id', id),
    curso.capa_path ? sb.storage.from('academy').createSignedUrl(curso.capa_path, 3600) : Promise.resolve({ data: null }),
  ]);

  const produtores = (prod ?? []) as ProdutorOpcao[];
  const linhasAula = ((aus ?? []) as unknown as LinhaAula[]).filter((a) => a.conteudo);
  const estrutura = montarEstrutura(
    (mods ?? []) as Array<{ id: string; titulo: string; posicao: number }>,
    linhasAula.map((a) => ({ id: a.id, modulo_id: a.modulo_id, conteudo_id: a.conteudo_id, posicao: a.posicao, titulo: a.conteudo!.titulo, tipo: a.conteudo!.tipo, duracao_min: a.conteudo!.duracao_min })),
  );
  const statusPorConteudo = new Map(linhasAula.map((a) => [a.conteudo_id, a.conteudo!.status]));
  const modulos: ModuloLinha[] = estrutura.map((m) => ({
    id: m.id, titulo: m.titulo,
    aulas: m.aulas.map((a) => ({ id: a.id, conteudo_id: a.conteudo_id, titulo: a.titulo, tipo: a.tipo, status: statusPorConteudo.get(a.conteudo_id) ?? 'rascunho', duracao_min: a.duracao_min })),
  }));
  const jaNoCurso = new Set(linhasAula.map((a) => a.conteudo_id));
  const disponiveis = ((disp ?? []) as ConteudoDisponivel[]).filter((c) => !jaNoCurso.has(c.id));
  const indicacoes: IndicacaoLinha[] = ((ind ?? []) as unknown as Array<IndicacaoLinha & { produtor: { nome: string } | null }>).map((i) => ({ ...i, produtor: i.produtor?.nome ?? 'Produtor' }));
  const codigos = new Map(((certs ?? []) as Array<{ produtor_id: string; codigo: string }>).map((c) => [c.produtor_id, c.codigo]));
  const alunos = (mats ?? []) as unknown as Array<{ produtor_id: string; criado_em: string; concluido_em: string | null; produtor: { nome: string } | null }>;

  const s = ROTULO_STATUS[curso.status as StatusConteudo];
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');
  const podeIndicar = pode(perfil?.perfis, 'academy.indicar');
  const indicadoAgora = Number(q.indicado ?? 0);

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Curso"
        titulo={curso.titulo}
        descricao={<><Tag tom={s.tom}>{s.txt}</Tag>{curso.revisado_em ? ` · revisado em ${dataBR(curso.revisado_em)}` : ''}</>}
        acoes={curso.status === 'publicado' ? <Link className="btn sec" href={`/academy/cursos/${curso.id}`}>Ver como o aluno vê</Link> : undefined}
      />

      {indicadoAgora > 0 ? <div className="aviso" role="status" style={{ marginBottom: 14 }}>Curso indicado a {indicadoAgora} produtor(es). Quem já tem login recebe o aviso.</div> : null}
      {!podeEditar ? <div className="aviso" style={{ marginBottom: 14 }}>Seu perfil só consulta os cursos. Quem edita é o agrônomo ou o proprietário.</div> : null}

      <Cartao olho="Curso" titulo={podeEditar ? 'Dados do curso' : 'Detalhes'}>
        <FormCurso curso={curso} produtores={produtores} selecionados={(pub ?? []).map((p) => p.produtor_id as string)} capaUrl={assinada.data?.signedUrl ?? null} podeEditar={podeEditar} />
      </Cartao>

      <div style={{ marginTop: 14 }}>
        <Estrutura cursoId={curso.id} modulos={modulos} disponiveis={disponiveis} podeEditar={podeEditar} />
      </div>

      {curso.status === 'publicado' ? (
        <div style={{ marginTop: 14 }}>
          <Indicacoes
            alvo={{ campo: 'curso_id', id: curso.id, rotulo: 'curso' }}
            retorno={`/academy/estudio/cursos/${curso.id}`}
            produtores={produtores}
            indicacoes={indicacoes}
            podeIndicar={podeIndicar}
            preselecionado={UUID.test(q.produtor ?? '') ? q.produtor : undefined}
            visitaId={UUID.test(q.visita ?? '') ? q.visita : undefined}
            analiseId={UUID.test(q.analise ?? '') ? q.analise : undefined}
          />
        </div>
      ) : <p className="nota" style={{ marginTop: 14 }}>Só curso publicado pode ser indicado a produtores.</p>}

      <div id="alunos" style={{ marginTop: 14 }}>
        <Cartao olho="Acompanhamento" titulo={`Alunos (${alunos.length})`}>
          {alunos.length === 0 ? <p className="nota" style={{ margin: 0 }}>Ninguém começou este curso ainda.</p> : (
            <div className="lista">
              {alunos.map((a) => (
                <div className="item" key={a.produtor_id}>
                  <div className="cresce">
                    <h3>{a.produtor?.nome ?? 'Produtor'}</h3>
                    <small>Começou em {dataBR(a.criado_em)}{a.concluido_em ? ` · concluiu em ${dataBR(a.concluido_em)}` : ''}{codigos.get(a.produtor_id) ? ` · certificado ${codigos.get(a.produtor_id)}` : ''}</small>
                  </div>
                  {a.concluido_em ? <Tag tom="ok">concluído</Tag> : <Tag tom="alerta">em andamento</Tag>}
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
