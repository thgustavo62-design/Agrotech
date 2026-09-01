import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { calcular } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura, CULTURAS, paraAnalise } from '@/lib/culturas';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { criarCompartilhamento, alternarCompartilhamento } from './acoes';
import { salvarPropriedade, salvarTalhao } from '../acoes';

export const dynamic = 'force-dynamic';

type TalhaoRow = {
  id: string; nome: string; cultura: string | null; area_ha: number | null; prod_esperada: number | null;
  propriedade: { nome: string | null } | null;
  analises: Array<{
    id: string; data_coleta: string;
    argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
    na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null; s: number | null;
  }>;
};

export default async function PaginaProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const [{ data: prod, error }, { data: talhoesRaw }, { data: propriedades }, { data: comps }, tabelas] =
    await Promise.all([
      sb.schema('agro').from('produtores').select('id, nome, email, fone, cpf_cnpj').eq('id', id).single(),
      sb.schema('agro').from('talhoes')
        .select(`id, nome, cultura, area_ha, prod_esperada,
                 propriedade:propriedade_id(nome),
                 analises:analises(id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s)`)
        .order('nome'),
      sb.schema('agro').from('propriedades').select('id, nome, municipio').order('nome'),
      sb.schema('agro').from('compartilhamentos')
        .select('id, cultura, rotulo, token, ativo, acessos')
        .eq('produtor_id', id).order('criado_em', { ascending: false }),
      tabelasDaOrg(sb),
    ]);

  if (error || !prod) notFound();

  const talhoes = (talhoesRaw ?? []) as unknown as TalhaoRow[];
  const props = (propriedades ?? []) as Array<{ id: string; nome: string; municipio: string | null }>;

  const porCultura = new Map<string, TalhaoRow[]>();
  for (const t of talhoes) {
    const chave = t.cultura ?? '__sem';
    if (!porCultura.has(chave)) porCultura.set(chave, []);
    porCultura.get(chave)!.push(t);
  }
  const culturasOrdenadas = [...porCultura.keys()].sort((a, b) => nomeCultura(a).localeCompare(nomeCultura(b)));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const totalAnalises = talhoes.reduce((s, t) => s + (t.analises?.length ?? 0), 0);
  const areaTotal = talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/app/produtores">← Produtores</Link>
      </div>

      <CabecalhoVista
        olho="Produtor"
        titulo={prod.nome as string}
        descricao={[prod.email, prod.fone, prod.cpf_cnpj].filter(Boolean).join(' · ') || 'sem contato cadastrado'}
        acoes={<Link className="btn sec" href={`/app/produtores/${id}/editar`}>Editar</Link>}
      />

      <Grade cols={4}>
        <Metrica rotulo="Culturas" valor={culturasOrdenadas.filter((c) => c !== '__sem').length} />
        <Metrica rotulo="Talhões" valor={talhoes.length} />
        <Metrica rotulo="Área" valor={`${f(areaTotal, 1)} ha`} />
        <Metrica rotulo="Análises" valor={totalAnalises} />
      </Grade>

      {culturasOrdenadas.length === 0 ? (
        <Vazio titulo="Nenhum talhão para este produtor">Cadastre uma propriedade e um talhão abaixo.</Vazio>
      ) : (
        culturasOrdenadas.map((chave) => {
          const ts = porCultura.get(chave)!;
          const cult = chave === '__sem' ? undefined : tabelas.culturas[chave];
          const areaCultura = ts.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
          return (
            <Cartao
              key={chave}
              olho={`Cultura · ${f(areaCultura, 1)} ha em ${ts.length} talhão(ões)`}
              titulo={nomeCultura(chave === '__sem' ? null : chave)}
              style={{ marginTop: 14 }}
            >
              <div className="rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>Talhão</th><th className="num">Área</th><th className="num">Última coleta</th>
                      <th className="num">V%</th><th className="num">m%</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {ts.map((t) => {
                      const ultima = [...(t.analises ?? [])].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))[0];
                      const r = ultima ? calcular(paraAnalise(ultima), tabelas) : null;
                      const V2 = cult?.V2 ?? 60;
                      const mMax = cult?.m_max ?? 20;
                      return (
                        <tr key={t.id}>
                          <td>
                            {t.nome}<br />
                            <small className="nota">{t.propriedade?.nome ?? '—'}</small>
                          </td>
                          <td className="num">{f(Number(t.area_ha ?? 0), 1)} ha</td>
                          <td className="num">{ultima ? dataBR(ultima.data_coleta) : '—'}</td>
                          <td className="num" style={{ color: r ? (r.V >= V2 ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                            {r ? `${f(r.V, 0)}%` : '—'}
                          </td>
                          <td className="num" style={{ color: r ? (r.m <= mMax ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                            {r ? `${f(r.m, 0)}%` : '—'}
                          </td>
                          <td className="num" style={{ whiteSpace: 'nowrap' }}>
                            <Link className="btn sec mini" href={`/app/talhoes/${t.id}/editar`}>editar</Link>{' '}
                            {ultima
                              ? <Link className="btn sec mini" href={`/app/analises/${ultima.id}`}>abrir</Link>
                              : <Link className="btn sec mini" href="/app/analises/nova">análise</Link>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Cartao>
          );
        })
      )}

      {/* -------- cadastro de propriedade e talhão -------- */}
      <Cartao olho="Cadastro" titulo="Adicionar" style={{ marginTop: 14 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Nova propriedade</summary>
          <form action={salvarPropriedade} className="grade g2" style={{ marginTop: 12 }}>
            <input type="hidden" name="produtor_id" value={id} />
            <div className="campo"><label htmlFor="pr_nome">Nome</label><input id="pr_nome" name="nome" required autoComplete="off" /></div>
            <div className="campo"><label htmlFor="pr_mun">Município</label><input id="pr_mun" name="municipio" autoComplete="off" /></div>
            <div className="campo"><label htmlFor="pr_uf">UF</label><input id="pr_uf" name="uf" defaultValue="ES" maxLength={2} /></div>
            <div className="campo"><label htmlFor="pr_area">Área total <span className="un">ha</span></label><input id="pr_area" name="area_total" className="mono" inputMode="decimal" /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar propriedade</button></div>
          </form>
        </details>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>＋ Novo talhão</summary>
          {props.length === 0 ? (
            <p className="nota" style={{ marginTop: 10 }}>Cadastre uma propriedade primeiro.</p>
          ) : (
            <form action={salvarTalhao} className="grade g2" style={{ marginTop: 12 }}>
              <input type="hidden" name="produtor_id" value={id} />
              <div className="campo">
                <label htmlFor="t_prop">Propriedade</label>
                <select id="t_prop" name="propriedade_id" required defaultValue="">
                  <option value="" disabled>selecione…</option>
                  {props.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="t_nome">Nome do talhão</label><input id="t_nome" name="nome" required autoComplete="off" /></div>
              <div className="campo">
                <label htmlFor="t_cult">Cultura</label>
                <select id="t_cult" name="cultura" required defaultValue="">
                  <option value="" disabled>selecione…</option>
                  {CULTURAS.map((c) => <option key={c} value={c}>{nomeCultura(c)}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="t_var">Variedade</label><input id="t_var" name="variedade" autoComplete="off" /></div>
              <div className="campo"><label htmlFor="t_area">Área <span className="un">ha</span></label><input id="t_area" name="area_ha" className="mono" inputMode="decimal" /></div>
              <div className="campo"><label htmlFor="t_prod">Produtividade esperada</label><input id="t_prod" name="prod_esperada" className="mono" inputMode="decimal" /></div>
              <div className="campo"><label htmlFor="t_esp">Espaçamento</label><input id="t_esp" name="espacamento" placeholder="3,0 × 1,2 m" autoComplete="off" /></div>
              <div className="campo"><label htmlFor="t_ano">Ano de implantação</label><input id="t_ano" name="ano_implantacao" className="mono" inputMode="numeric" /></div>
              <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar talhão</button></div>
            </form>
          )}
        </details>
      </Cartao>

      {/* -------- links de resultados -------- */}
      <Cartao olho="Acesso do produtor" titulo="Links de resultados" style={{ marginTop: 14 }}>
        <p className="nota" style={{ margin: '0 0 12px' }}>
          Gera um endereço que o produtor abre sem login e vê os resultados em tempo real — a lavoura
          toda ou uma cultura só.
        </p>

        {(comps ?? []).length > 0 && (
          <div className="lista" style={{ marginBottom: 14 }}>
            {(comps ?? []).map((c) => (
              <div className="item" key={c.id as string}>
                <div className="cresce" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <strong>{(c.rotulo as string) || nomeCultura((c.cultura as string) ?? null)}</strong>{' '}
                    {c.cultura ? <Tag tom="cinza">{nomeCultura(c.cultura as string)}</Tag> : <Tag>lavoura toda</Tag>}{' '}
                    <span className="nota">{c.acessos as number} acesso(s)</span>
                  </div>
                  <LinkCompartilhado url={`${appUrl}/r/${c.token}`} />
                </div>
                <form action={alternarCompartilhamento}>
                  <input type="hidden" name="id" value={c.id as string} />
                  <input type="hidden" name="produtor_id" value={id} />
                  <input type="hidden" name="ativo" value={String(c.ativo)} />
                  <button className="btn sec mini" type="submit">{c.ativo ? 'desativar' : 'reativar'}</button>
                </form>
              </div>
            ))}
          </div>
        )}

        <form action={criarCompartilhamento} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="hidden" name="produtor_id" value={id} />
          <div className="campo" style={{ minWidth: 200 }}>
            <label htmlFor="cultura">Escopo</label>
            <select id="cultura" name="cultura" defaultValue="__todas">
              <option value="__todas">Lavoura toda</option>
              {culturasOrdenadas.filter((c) => c !== '__sem').map((c) => (
                <option key={c} value={c}>{nomeCultura(c)}</option>
              ))}
            </select>
          </div>
          <div className="campo" style={{ minWidth: 200 }}>
            <label htmlFor="rotulo">Rótulo (opcional)</label>
            <input id="rotulo" name="rotulo" placeholder="ex.: Safra 2026" autoComplete="off" />
          </div>
          <button className="btn verde" type="submit">Gerar link</button>
        </form>
      </Cartao>
    </>
  );
}
