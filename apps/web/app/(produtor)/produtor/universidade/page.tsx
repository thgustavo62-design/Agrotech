import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { Cartao, Tag, Vazio } from '@/components/ui';
import {
  ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO, TEMAS, TIPOS, filtrarConteudos, type Conteudo, type Tema, type TipoConteudo,
} from '@/lib/academy';

export const dynamic = 'force-dynamic';

type Busca = { q?: string; tipo?: string; tema?: string };

interface IndicacaoDoProdutor {
  id: string;
  mensagem: string | null;
  criado_em: string;
  aberto_em: string | null;
  concluido_em: string | null;
  conteudo: { id: string; titulo: string; tipo: TipoConteudo; tema: Tema | null; duracao_min: number | null } | null;
}

export default async function Universidade({ searchParams }: { searchParams: Promise<Busca> }) {
  const f = await searchParams;
  const sb = await criarClienteServidor();

  // a RLS já entrega só o que foi publicado e é para este produtor; nada de outro escritório ou de outro produtor chega aqui
  const [{ data: ind }, { data: cont }] = await Promise.all([
    sb.schema('agro').from('academy_indicacoes')
      .select('id, mensagem, criado_em, aberto_em, concluido_em, conteudo:conteudo_id(id, titulo, tipo, tema, duracao_min)')
      .order('criado_em', { ascending: false }),
    sb.schema('agro').from('academy_conteudos')
      .select('id, tipo, titulo, descricao, cultura, tema, nivel, duracao_min, fonte, status, publicado_em, criado_em')
      .eq('status', 'publicado') // a RLS já garante; o filtro deixa a página correta mesmo sem ela
      .order('publicado_em', { ascending: false }),
  ]);

  const indicacoes = ((ind ?? []) as unknown as IndicacaoDoProdutor[]).filter((i) => i.conteudo);
  const conteudos = (cont ?? []) as unknown as Conteudo[];
  const porConteudo = new Map(indicacoes.map((i) => [i.conteudo!.id, i]));

  const pendentes = indicacoes.filter((i) => !i.concluido_em);
  const concluidas = indicacoes.length - pendentes.length;
  const lista = filtrarConteudos(conteudos, { busca: f.q, tipo: f.tipo, tema: f.tema });
  const filtrando = Boolean(f.q || f.tipo || f.tema);

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo="Universidade"
        descricao="Aulas, artigos e materiais que o seu agrônomo separou para você."
        tags={['Aprender', 'Indicado para você', 'Biblioteca']}
      />

      {indicacoes.length > 0 && (
        <Cartao olho="Indicado pelo seu agrônomo" titulo={pendentes.length > 0 ? `Para você ver (${pendentes.length})` : 'Tudo em dia'}>
          <div className="progresso-barra" aria-hidden="true" style={{ marginBottom: 6 }}>
            <i style={{ width: `${Math.round((concluidas / indicacoes.length) * 100)}%` }} />
          </div>
          <p className="nota" style={{ margin: '0 0 12px' }}>{concluidas} de {indicacoes.length} concluído(s)</p>
          <div className="lista">
            {indicacoes.map((i) => (
              <div className="item" key={i.id}>
                <div className="cresce">
                  <h3>{i.conteudo!.titulo}</h3>
                  <small>
                    {ROTULO_TIPO[i.conteudo!.tipo]}
                    {i.conteudo!.duracao_min ? ` · ${i.conteudo!.duracao_min} min` : ''}
                    {` · indicado em ${dataBR(i.criado_em)}`}
                  </small>
                  {i.mensagem ? <p className="nota" style={{ margin: '4px 0 0' }}>“{i.mensagem}”</p> : null}
                </div>
                {i.concluido_em ? <Tag tom="ok">concluído</Tag> : i.aberto_em ? <Tag tom="alerta">em andamento</Tag> : <Tag tom="alerta">novo</Tag>}
                <Link className="btn sec mini" href={`/produtor/universidade/${i.conteudo!.id}`}>{i.concluido_em ? 'rever' : 'abrir'}</Link>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <div style={{ marginTop: indicacoes.length > 0 ? 14 : 0 }}>
        <Cartao olho={filtrando ? `${lista.length} de ${conteudos.length}` : `${conteudos.length} disponível(is)`} titulo="Biblioteca">
          <form className="filtros-academy" method="get">
            <div className="campo busca">
              <label htmlFor="q">Buscar</label>
              <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="ex.: calagem, ferrugem, adubação…" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={f.tipo ?? ''}>
                <option value="">Todos</option>
                {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tema">Tema</label>
              <select id="tema" name="tema" defaultValue={f.tema ?? ''}>
                <option value="">Todos</option>
                {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
              </select>
            </div>
            <button className="btn sec" type="submit">Filtrar</button>
            {filtrando ? <Link className="btn sec" href="/produtor/universidade">Limpar</Link> : null}
          </form>

          {conteudos.length === 0 ? (
            <Vazio titulo="Ainda não há conteúdos para você">
              Quando o seu agrônomo publicar ou indicar uma aula, ela aparece aqui e você recebe um aviso.
            </Vazio>
          ) : lista.length === 0 ? (
            <Vazio titulo="Nada encontrado com esses filtros" />
          ) : (
            <div className="lista">
              {lista.map((c) => {
                const i = porConteudo.get(c.id);
                return (
                  <div className="item" key={c.id}>
                    <div className="cresce">
                      <h3>{c.titulo}</h3>
                      <small>
                        {ROTULO_TIPO[c.tipo]}
                        {c.tema ? ` · ${ROTULO_TEMA[c.tema]}` : ''}
                        {c.cultura ? ` · ${c.cultura}` : ''}
                        {` · ${ROTULO_NIVEL[c.nivel]}`}
                        {c.duracao_min ? ` · ${c.duracao_min} min` : ''}
                      </small>
                      {c.descricao ? <p className="nota" style={{ margin: '4px 0 0' }}>{c.descricao}</p> : null}
                    </div>
                    {i?.concluido_em ? <Tag tom="ok">concluído</Tag> : i ? <Tag tom="alerta">indicado</Tag> : null}
                    <Link className="btn sec mini" href={`/produtor/universidade/${c.id}`}>abrir</Link>
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
