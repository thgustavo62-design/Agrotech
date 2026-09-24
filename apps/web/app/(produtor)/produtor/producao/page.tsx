import Link from 'next/link';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { f, dataBR, moeda } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { Cartao, Grade, Metrica, Vazio } from '@/components/ui';
import { BannerHero } from '@/components/banner-hero';
import { criarSafra, criarProducao, excluirProducao } from './acoes';

export const dynamic = 'force-dynamic';

type Safra = { id: string; nome: string; inicio: string | null; fim: string | null };
type Talhao = { id: string; nome: string; cultura: string | null };
type Registro = {
  id: string; talhao_id: string | null; safra_id: string | null; cultura: string | null;
  area_ha: number | null; producao_prevista: number | null; producao_realizada: number | null;
  unidade: string; preco_medio: number | null; receita_obtida: number | null; observacao: string | null;
  criado_em: string;
};

export default async function ProducaoProdutor() {
  const produtor = await produtorAtual();
  if (!produtor) notFound();

  const sb = await criarClienteServidor();
  const [{ data: safrasRaw }, { data: talhoesRaw }, { data: registrosRaw }] = await Promise.all([
    sb.schema('agro').from('safras').select('id, nome, inicio, fim').order('criado_em', { ascending: false }),
    sb.schema('agro').from('talhoes').select('id, nome, cultura').order('nome'),
    sb.schema('agro').from('producao_registros')
      .select('id, talhao_id, safra_id, cultura, area_ha, producao_prevista, producao_realizada, unidade, preco_medio, receita_obtida, observacao, criado_em')
      .order('criado_em', { ascending: false }),
  ]);

  const safras = (safrasRaw ?? []) as Safra[];
  const talhoes = (talhoesRaw ?? []) as Talhao[];
  const registros = (registrosRaw ?? []) as Registro[];

  const nomeTalhao = (id: string | null) => talhoes.find((t) => t.id === id)?.nome ?? '—';
  const nomeSafra = (id: string | null) => safras.find((s) => s.id === id)?.nome ?? 'Sem safra';

  const porSafra = new Map<string, Registro[]>();
  for (const r of registros) {
    const chave = r.safra_id ?? '__sem';
    if (!porSafra.has(chave)) porSafra.set(chave, []);
    porSafra.get(chave)!.push(r);
  }

  const totalPrevista = registros.reduce((s, r) => s + Number(r.producao_prevista ?? 0), 0);
  const totalRealizada = registros.reduce((s, r) => s + Number(r.producao_realizada ?? 0), 0);
  const totalReceita = registros.reduce((s, r) => s + Number(r.receita_obtida ?? 0), 0);
  const atingimento = totalPrevista > 0 ? (100 * totalRealizada) / totalPrevista : null;

  return (
    <>
      <BannerHero
        olho="Sua lavoura"
        titulo="Produção"
        descricao="Produtividade esperada e realizada por safra e por talhão."
        tags={['Safra', 'Colheita', 'Resultado']}
      />

      <Grade cols={3}>
        <Metrica rotulo="Prevista (total)" valor={f(totalPrevista, 1)} />
        <Metrica rotulo="Realizada (total)" valor={f(totalRealizada, 1)} detalhe={atingimento != null ? `${f(atingimento, 0)}% do previsto` : undefined} />
        <Metrica rotulo="Receita registrada" valor={moeda(totalReceita)} />
      </Grade>

      {registros.length === 0 ? (
        <Vazio titulo="Nenhum registro de produção ainda" style={{ marginTop: 14 }} />
      ) : (
        [...porSafra.entries()].map(([chave, regs]) => {
          const prevista = regs.reduce((s, r) => s + Number(r.producao_prevista ?? 0), 0);
          const realizada = regs.reduce((s, r) => s + Number(r.producao_realizada ?? 0), 0);
          const pct = prevista > 0 ? (100 * realizada) / prevista : null;
          return (
            <Cartao
              key={chave}
              olho={pct != null ? `${f(pct, 0)}% do previsto` : 'Sem meta prevista'}
              titulo={nomeSafra(chave === '__sem' ? null : chave)}
              style={{ marginTop: 14 }}
            >
              <div className="lista">
                {regs.map((r) => (
                  <div className="item" key={r.id}>
                    <div className="cresce">
                      <h3>{nomeTalhao(r.talhao_id)}</h3>
                      <small className="mono">
                        {nomeCultura(r.cultura)} · {f(Number(r.area_ha ?? 0), 1)} ha
                        {r.producao_prevista != null ? ` · previsto ${f(Number(r.producao_prevista), 1)} ${r.unidade}` : ''}
                        {r.producao_realizada != null ? ` · realizado ${f(Number(r.producao_realizada), 1)} ${r.unidade}` : ''}
                        {r.receita_obtida != null ? ` · ${moeda(Number(r.receita_obtida))}` : ''}
                      </small>
                      {r.observacao ? <p className="nota" style={{ margin: '4px 0 0' }}>{r.observacao}</p> : null}
                    </div>
                    <form action={excluirProducao}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn sec mini" type="submit">excluir</button>
                    </form>
                  </div>
                ))}
              </div>
            </Cartao>
          );
        })
      )}

      <Cartao olho="Novo" titulo="Lançar produção" style={{ marginTop: 14 }}>
        {talhoes.length === 0 ? (
          <p className="nota">Você ainda não tem talhão cadastrado — fale com o seu técnico.</p>
        ) : (
          <form action={criarProducao} className="grade g2">
            <div className="campo">
              <label htmlFor="p_talhao">Talhão</label>
              <select id="p_talhao" name="talhao_id" required defaultValue="">
                <option value="" disabled>selecione…</option>
                {talhoes.map((t) => <option key={t.id} value={t.id}>{t.nome} — {nomeCultura(t.cultura)}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="p_safra">Safra (opcional)</label>
              <select id="p_safra" name="safra_id" defaultValue="">
                <option value="">sem safra</option>
                {safras.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="campo"><label htmlFor="p_area">Área <span className="un">ha</span></label><input id="p_area" name="area_ha" className="mono" inputMode="decimal" placeholder="do talhão, se vazio" /></div>
            <div className="campo">
              <label htmlFor="p_un">Unidade</label>
              <input id="p_un" name="unidade" list="un-sugestoes" defaultValue="sc" autoComplete="off" />
              <datalist id="un-sugestoes">
                <option value="sc" /><option value="t" /><option value="kg" /><option value="un" />
              </datalist>
            </div>
            <div className="campo"><label htmlFor="p_prev">Produção prevista</label><input id="p_prev" name="producao_prevista" className="mono" inputMode="decimal" /></div>
            <div className="campo"><label htmlFor="p_real">Produção realizada</label><input id="p_real" name="producao_realizada" className="mono" inputMode="decimal" /></div>
            <div className="campo"><label htmlFor="p_preco">Preço médio <span className="un">R$</span></label><input id="p_preco" name="preco_medio" className="mono" inputMode="decimal" /></div>
            <div className="campo"><label htmlFor="p_receita">Receita obtida <span className="un">R$</span></label><input id="p_receita" name="receita_obtida" className="mono" inputMode="decimal" placeholder="calculado se vazio" /></div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="p_obs">Observação (opcional)</label>
              <input id="p_obs" name="observacao" autoComplete="off" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar</button></div>
          </form>
        )}
      </Cartao>

      <Cartao olho={`${safras.length} safra(s)`} titulo="Safras" style={{ marginTop: 14 }}>
        {safras.length > 0 && (
          <div className="lista" style={{ marginBottom: 14 }}>
            {safras.map((s) => (
              <div className="item" key={s.id}>
                <div className="cresce">
                  <h3>{s.nome}</h3>
                  <small>{s.inicio ? dataBR(s.inicio) : '—'} a {s.fim ? dataBR(s.fim) : '—'}</small>
                </div>
              </div>
            ))}
          </div>
        )}
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Nova safra</summary>
          <form action={criarSafra} className="grade g2" style={{ marginTop: 10 }}>
            <div className="campo"><label htmlFor="s_nome">Nome</label><input id="s_nome" name="nome" required placeholder="ex.: 2026/2027" autoComplete="off" /></div>
            <div className="campo"><label htmlFor="s_inicio">Início (opcional)</label><input id="s_inicio" name="inicio" type="date" /></div>
            <div className="campo"><label htmlFor="s_fim">Fim (opcional)</label><input id="s_fim" name="fim" type="date" /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar safra</button></div>
          </form>
        </details>
      </Cartao>

      <p className="nota" style={{ marginTop: 14 }}>
        Seu técnico vê a área, a produção prevista/realizada e o talhão — nunca o preço nem a receita.{' '}
        <Link href="/produtor/talhoes">Ver situação dos talhões</Link>.
      </p>
    </>
  );
}
