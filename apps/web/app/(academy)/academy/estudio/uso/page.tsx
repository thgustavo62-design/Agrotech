import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { resumirUso, type UsoConteudo, type UsoCurso, type UsoIndicacao, type UsoMatricula, type UsoProdutor } from '@/lib/academy-uso';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BarrasAgrupadas } from '@/components/graficos';

export const dynamic = 'force-dynamic';

const ROTULO_TIPO_INDICACAO = { conteudo: 'conteúdo', curso: 'curso', ficha: 'ficha do Atlas' } as const;
const LIM = 20000;

type Rel = { titulo: string } | { titulo: string }[] | null;
const tituloDe = (r: Rel) => (Array.isArray(r) ? r[0]?.titulo : r?.titulo) ?? null;

/**
 * Painel de uso da Academy. Soma o que o banco já guarda — matrículas, progresso, indicações, certificados — para a equipe ver
 * quem está estudando, o que funciona e o que ficou sem resposta. A RLS limita tudo ao próprio escritório.
 */
export default async function UsoDaAcademy() {
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');

  const [prod, cursos, conteudos, mats, prog, certs, indConteudo, indAtlas, pedidos] = await Promise.all([
    s.from('produtores').select('id, nome').order('nome').limit(5000),
    s.from('academy_cursos').select('id, titulo').limit(2000),
    s.from('academy_conteudos').select('id, titulo, tipo').limit(5000),
    s.from('academy_matriculas').select('curso_id, produtor_id, criado_em, concluido_em').limit(LIM),
    s.from('academy_progresso').select('produtor_id, conteudo_id, iniciado_em, concluido_em').limit(LIM),
    s.from('academy_certificados').select('produtor_id, emitido_em').limit(LIM),
    s.from('academy_indicacoes').select('produtor_id, criado_em, aberto_em, conteudo:conteudo_id(titulo), curso:curso_id(titulo)').limit(LIM),
    s.from('atlas_indicacoes').select('produtor_id, titulo, criado_em, aberto_em').limit(LIM),
    s.from('atendimentos').select('id', { count: 'exact', head: true }).eq('origem', 'atlas'),
  ]);

  const indicacoes: UsoIndicacao[] = [
    ...((indConteudo.data ?? []) as unknown as Array<{ produtor_id: string; criado_em: string; aberto_em: string | null; conteudo: Rel; curso: Rel }>).map((i): UsoIndicacao => {
      const titulo = tituloDe(i.curso) ?? tituloDe(i.conteudo) ?? 'Conteúdo removido';
      return { produtor_id: i.produtor_id, tipo: tituloDe(i.curso) ? 'curso' : 'conteudo', titulo, criado_em: i.criado_em, aberto_em: i.aberto_em };
    }),
    ...((indAtlas.data ?? []) as Array<{ produtor_id: string; titulo: string; criado_em: string; aberto_em: string | null }>).map((i): UsoIndicacao => ({ ...i, tipo: 'ficha' })),
  ];

  const r = resumirUso({
    produtores: (prod.data ?? []) as UsoProdutor[],
    cursos: (cursos.data ?? []) as UsoCurso[],
    conteudos: (conteudos.data ?? []) as UsoConteudo[],
    matriculas: (mats.data ?? []) as UsoMatricula[],
    progresso: (prog.data ?? []) as Array<{ produtor_id: string; conteudo_id: string; iniciado_em: string | null; concluido_em: string | null }>,
    certificados: (certs.data ?? []) as Array<{ produtor_id: string; emitido_em: string }>,
    indicacoes,
    pedidosDoAtlas: pedidos.count ?? 0,
  });

  const temAtividade = [...r.porMes.matriculas, ...r.porMes.aulasConcluidas, ...r.porMes.certificados].some((n) => n > 0);

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Uso"
        titulo="Como a Academy está sendo usada"
        descricao="Quem está estudando, o que funciona e o que ficou sem resposta — tudo calculado do que os produtores realmente fizeram."
      />

      <Grade cols={4}>
        <Metrica rotulo="Produtores ativos (30 dias)" valor={r.ativosNosUltimos30Dias} detalhe={`de ${r.produtores} cadastrados`} />
        <Metrica rotulo="Matrículas" valor={r.matriculas} detalhe={`${r.concluidas} concluída(s)`} />
        <Metrica rotulo="Taxa de conclusão" valor={`${r.taxaDeConclusao}%`} detalhe={`${r.certificados} certificado(s)`} />
        <Metrica rotulo="Aulas concluídas" valor={r.aulasConcluidas} />
      </Grade>
      <Grade cols={4} style={{ marginTop: 12 }}>
        <Metrica rotulo="Indicações enviadas" valor={r.indicacoes} />
        <Metrica rotulo="Indicações sem abrir" valor={r.indicacoesSemAbrir} cor={r.indicacoesSemAbrir > 0 ? 'var(--c-b)' : undefined} />
        <Metrica rotulo="Pedidos nascidos do Atlas" valor={r.pedidosDoAtlas} detalhe="“Suspeito disso na minha lavoura”" />
        <Metrica rotulo="Cursos com alunos" valor={r.porCurso.length} />
      </Grade>

      <Cartao olho="Últimos 6 meses" titulo="Atividade por mês" style={{ marginTop: 14 }}>
        {!temAtividade ? (
          <Vazio titulo="Ainda não há atividade nesse período">Quando os produtores se matricularem e concluírem aulas, o gráfico aparece aqui.</Vazio>
        ) : (
          <BarrasAgrupadas
            categorias={r.porMes.rotulos}
            series={[
              { nome: 'Matrículas', valores: r.porMes.matriculas, classe: 's1' },
              { nome: 'Aulas concluídas', valores: r.porMes.aulasConcluidas, classe: 's2' },
              { nome: 'Certificados', valores: r.porMes.certificados, classe: 's3' },
            ]}
            resumo={`Atividade da Academy nos últimos 6 meses: ${r.porMes.matriculas.reduce((a, b) => a + b, 0)} matrículas, ${r.porMes.aulasConcluidas.reduce((a, b) => a + b, 0)} aulas concluídas e ${r.porMes.certificados.reduce((a, b) => a + b, 0)} certificados.`}
          />
        )}
      </Cartao>

      <Cartao olho="Para cobrar" titulo="Indicações sem resposta há 7 dias ou mais" style={{ marginTop: 14 }}>
        {r.paraCobrar.length === 0 ? (
          <p className="nota">Nenhuma indicação esperando há muito tempo. {r.indicacoesSemAbrir > 0 ? `Há ${r.indicacoesSemAbrir} mais recente(s) ainda sem abrir.` : ''}</p>
        ) : (
          <div className="lista">
            {r.paraCobrar.map((i, n) => (
              <div className="item" key={`${i.produtor}-${i.titulo}-${n}`}>
                <div className="cresce">
                  <h3>{i.titulo}</h3>
                  <small>{ROTULO_TIPO_INDICACAO[i.tipo]} · indicada a {i.produtor}</small>
                </div>
                <Tag tom={i.dias >= 14 ? 'ruim' : 'alerta'}>{i.dias} dias sem abrir</Tag>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
        <Cartao olho="Cursos" titulo="Matrículas e conclusão">
          {r.porCurso.length === 0 ? (
            <Vazio titulo="Nenhuma matrícula ainda" />
          ) : (
            <div className="rolagem">
              <table>
                <thead><tr><th>Curso</th><th className="num">Matr.</th><th className="num">Concl.</th><th className="num">Taxa</th></tr></thead>
                <tbody>
                  {r.porCurso.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/academy/estudio/cursos/${c.id}`}>{c.titulo}</Link></td>
                      <td className="num">{c.matriculados}</td>
                      <td className="num">{c.concluidos}</td>
                      <td className="num">{c.taxa}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        <Cartao olho="Aulas" titulo="O que mais é concluído">
          {r.conteudos.length === 0 ? (
            <Vazio titulo="Nenhuma aula iniciada ainda" />
          ) : (
            <div className="rolagem">
              <table>
                <thead><tr><th>Conteúdo</th><th className="num">Iniciou</th><th className="num">Concluiu</th></tr></thead>
                <tbody>
                  {r.conteudos.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/academy/estudio/conteudos/${c.id}`}>{c.titulo}</Link></td>
                      <td className="num">{c.iniciados}</td>
                      <td className="num">{c.concluidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </Grade>

      <Cartao olho="Produtores" titulo="Quem está estudando" style={{ marginTop: 14 }}>
        {r.alunos.length === 0 ? (
          <Vazio titulo="Nenhum produtor cadastrado" />
        ) : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Produtor</th><th className="num">Cursos em andamento</th><th className="num">Concluídos</th><th className="num">Aulas feitas</th><th>Última atividade</th><th className="num">Indicações sem abrir</th></tr></thead>
              <tbody>
                {r.alunos.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/app/produtores/${a.id}`}>{a.nome}</Link></td>
                    <td className="num">{a.cursosEmAndamento}</td>
                    <td className="num">{a.cursosConcluidos}</td>
                    <td className="num">{a.aulasConcluidas}</td>
                    <td>
                      {a.ultimaAtividade ? (
                        <>{dataBR(a.ultimaAtividade.slice(0, 10))} {a.diasParado != null && a.diasParado > 30 ? <Tag tom="alerta">parado há {a.diasParado} dias</Tag> : null}</>
                      ) : <Tag tom="cinza">ainda não acessou</Tag>}
                    </td>
                    <td className="num">{a.indicacoesPendentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      <p className="nota" style={{ marginTop: 12 }}>
        “Atividade” é matrícula, aula iniciada ou concluída e indicação aberta. Indicação enviada e ainda não aberta não conta como atividade.
        A Academy não mede tempo de tela nem por onde a pessoa navegou — só o que ela fez de concreto.
      </p>
    </>
  );
}
