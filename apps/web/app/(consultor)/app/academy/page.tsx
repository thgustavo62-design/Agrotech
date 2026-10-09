import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { dataBR } from '@/lib/formato';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { IconeAcademy } from '@/components/icones';
import {
  ROTULO_NIVEL, ROTULO_STATUS, ROTULO_TEMA, ROTULO_TIPO, TEMAS, TIPOS, filtrarConteudos, type Conteudo,
} from '@/lib/academy';

export const dynamic = 'force-dynamic';

type Busca = { q?: string; tipo?: string; tema?: string; status?: string };

export default async function Academy({ searchParams }: { searchParams: Promise<Busca> }) {
  const f = await searchParams;
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');

  const [{ data }, { data: ind }] = await Promise.all([
    sb.schema('agro').from('academy_conteudos')
      .select('id, tipo, titulo, descricao, cultura, tema, nivel, duracao_min, url, corpo, arquivo_path, fonte, status, visibilidade, revisado_em, publicado_em, criado_em, atualizado_em')
      .order('atualizado_em', { ascending: false }),
    sb.schema('agro').from('academy_indicacoes').select('conteudo_id, aberto_em, concluido_em'),
  ]);

  const todos = (data ?? []) as unknown as Conteudo[];
  const porConteudo = new Map<string, { total: number; concluidas: number }>();
  for (const i of ind ?? []) {
    const atual = porConteudo.get(i.conteudo_id as string) ?? { total: 0, concluidas: 0 };
    atual.total += 1;
    if (i.concluido_em) atual.concluidas += 1;
    porConteudo.set(i.conteudo_id as string, atual);
  }

  const lista = filtrarConteudos(todos, { busca: f.q, tipo: f.tipo, tema: f.tema, status: f.status });
  const publicados = todos.filter((c) => c.status === 'publicado').length;
  const rascunhos = todos.filter((c) => c.status === 'rascunho').length;
  const indicacoes = (ind ?? []).length;
  const concluidas = (ind ?? []).filter((i) => i.concluido_em).length;
  const filtrando = Boolean(f.q || f.tipo || f.tema || f.status);

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Relacionamento"
        titulo="Academy"
        descricao="A universidade dos seus produtores: aulas, artigos e materiais que você escolhe, publica e indica depois de uma visita ou de um laudo."
        tags={['Vídeos', 'Artigos', 'Materiais', 'Indicação']}
        acoes={podeEditar ? <Link className="btn verde" href="/app/academy/novo">Novo conteúdo</Link> : undefined}
      />

      {todos.length > 0 && (
        <Grade cols={4} style={{ marginBottom: 14 }}>
          <Metrica rotulo="Publicados" valor={publicados} icone={IconeAcademy} />
          <Metrica rotulo="Rascunhos" valor={rascunhos} cor={rascunhos ? 'var(--c-b)' : undefined} />
          <Metrica rotulo="Indicações feitas" valor={indicacoes} />
          <Metrica rotulo="Concluídas pelos produtores" valor={concluidas} />
        </Grade>
      )}

      <Cartao olho={filtrando ? `${lista.length} de ${todos.length}` : `${todos.length} conteúdo(s)`} titulo="Biblioteca do escritório">
        <form className="filtros-academy" method="get">
          <div className="campo busca">
            <label htmlFor="q">Buscar</label>
            <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="título, cultura, fonte…" autoComplete="off" />
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
          <div className="campo">
            <label htmlFor="status">Situação</label>
            <select id="status" name="status" defaultValue={f.status ?? ''}>
              <option value="">Todas</option>
              <option value="publicado">Publicados</option>
              <option value="rascunho">Rascunhos</option>
              <option value="arquivado">Arquivados</option>
            </select>
          </div>
          <button className="btn sec" type="submit">Filtrar</button>
          {filtrando ? <Link className="btn sec" href="/app/academy">Limpar</Link> : null}
        </form>

        {todos.length === 0 ? (
          <Vazio titulo="Sua universidade ainda está vazia">
            {podeEditar
              ? <>Comece com um vídeo que você já usa com os produtores. <Link href="/app/academy/novo">Criar o primeiro conteúdo.</Link></>
              : 'Quando o agrônomo do escritório publicar conteúdos, eles aparecem aqui.'}
          </Vazio>
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum conteúdo com esses filtros" />
        ) : (
          <div className="lista">
            {lista.map((c) => {
              const s = ROTULO_STATUS[c.status];
              const n = porConteudo.get(c.id);
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
                      {c.visibilidade === 'selecionados' ? ' · só selecionados' : ''}
                      {n ? ` · indicado a ${n.total}${n.concluidas ? `, ${n.concluidas} concluiu` : ''}` : ''}
                      {` · atualizado em ${dataBR(c.atualizado_em ?? c.criado_em)}`}
                    </small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                  <Link className="btn sec mini" href={`/app/academy/${c.id}`}>{podeEditar ? 'abrir' : 'ver'}</Link>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
