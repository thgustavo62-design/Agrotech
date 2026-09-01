import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { calcular, PADRAO } from '@agrotech/agro-core';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura, culturaDe, paraAnalise } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { criarCompartilhamento, alternarCompartilhamento } from './acoes';

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

  const [{ data: prod, error }, { data: talhoesRaw }, { data: comps }] = await Promise.all([
    sb.schema('agro').from('produtores').select('id, nome, email, fone').eq('id', id).single(),
    sb.schema('agro').from('talhoes')
      .select(`id, nome, cultura, area_ha, prod_esperada,
               propriedade:propriedade_id(nome),
               analises:analises(id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, s)`)
      .order('nome'),
    sb.schema('agro').from('compartilhamentos')
      .select('id, cultura, rotulo, token, ativo, acessos, ultimo_acesso')
      .eq('produtor_id', id)
      .order('criado_em', { ascending: false }),
  ]);

  if (error || !prod) notFound();

  const talhoes = (talhoesRaw ?? []) as unknown as TalhaoRow[];
  const meusTalhoes = talhoes.filter((t) => (t.propriedade ? true : true)); // já escopado por RLS

  // agrupa por cultura
  const porCultura = new Map<string, TalhaoRow[]>();
  for (const t of meusTalhoes) {
    const chave = t.cultura ?? '__sem';
    if (!porCultura.has(chave)) porCultura.set(chave, []);
    porCultura.get(chave)!.push(t);
  }
  const culturasOrdenadas = [...porCultura.keys()].sort((a, b) => nomeCultura(a).localeCompare(nomeCultura(b)));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const totalAnalises = meusTalhoes.reduce((s, t) => s + (t.analises?.length ?? 0), 0);
  const areaTotal = meusTalhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href="/app/produtores">← Produtores</Link>
      </div>

      <CabecalhoVista
        olho="Produtor"
        titulo={prod.nome as string}
        descricao={[prod.email, prod.fone].filter(Boolean).join(' · ') || 'sem contato cadastrado'}
      />

      <Grade cols={4}>
        <Metrica rotulo="Culturas" valor={culturasOrdenadas.filter((c) => c !== '__sem').length} />
        <Metrica rotulo="Talhões" valor={meusTalhoes.length} />
        <Metrica rotulo="Área" valor={`${f(areaTotal, 1)} ha`} />
        <Metrica rotulo="Análises" valor={totalAnalises} />
      </Grade>

      {culturasOrdenadas.length === 0 ? (
        <Vazio titulo="Nenhum talhão para este produtor" />
      ) : (
        culturasOrdenadas.map((chave) => {
          const ts = porCultura.get(chave)!;
          const cult = culturaDe(chave === '__sem' ? null : chave);
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
                      <th>Talhão</th>
                      <th className="num">Área</th>
                      <th className="num">Última coleta</th>
                      <th className="num">V%</th>
                      <th className="num">m%</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ts.map((t) => {
                      const ultima = [...(t.analises ?? [])].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))[0];
                      const r = ultima ? calcular(paraAnalise(ultima), PADRAO) : null;
                      const V2 = cult?.V2 ?? 60;
                      const mMax = cult?.m_max ?? 20;
                      return (
                        <tr key={t.id}>
                          <td>
                            {t.nome}
                            <br />
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
                          <td className="num">
                            {ultima ? <Link className="btn sec mini" href={`/app/analises/${ultima.id}`}>Abrir</Link> : null}
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
                  <button className="btn sec mini" type="submit">
                    {c.ativo ? 'desativar' : 'reativar'}
                  </button>
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
