import Link from 'next/link';
import { nomeCultura, CULTURAS } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { Cartao, Vazio } from '@/components/ui';
import { salvarTalhao } from '../../acoes';
import type { ContextoProdutor } from '../dados';

export function PainelTalhoes({ ctx }: { ctx: ContextoProdutor }) {
  const { id, propriedades, porCultura, culturasOrdenadas } = ctx;

  return (
    (
      <>
        {culturasOrdenadas.length === 0 ? (
          <Vazio titulo="Nenhum talhão para este produtor">Cadastre uma propriedade e um talhão abaixo.</Vazio>
        ) : (
          culturasOrdenadas.map((chave) => {
            const grupo = porCultura.get(chave)!;
            const areaCultura = grupo.reduce((s, x) => s + Number(x.talhao.area_ha ?? 0), 0);
            return (
              <Cartao
                key={chave}
                olho={`Cultura · ${f(areaCultura, 1)} ha em ${grupo.length} talhão(ões)`}
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
                      {grupo.map((x) => (
                        <tr key={x.talhao.id}>
                          <td>
                            <Link href={`/app/talhoes/${x.talhao.id}`}>{x.talhao.nome}</Link><br />
                            <small className="nota">{x.talhao.propriedade?.nome ?? '—'}</small>
                          </td>
                          <td className="num">{f(Number(x.talhao.area_ha ?? 0), 1)} ha</td>
                          <td className="num">{x.ultima ? dataBR(x.ultima.data_coleta) : '—'}</td>
                          <td className="num" style={{ color: x.r ? (x.r.V >= x.V2 ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                            {x.r ? `${f(x.r.V, 0)}%` : '—'}
                          </td>
                          <td className="num" style={{ color: x.r ? (x.r.m <= x.mMax ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined }}>
                            {x.r ? `${f(x.r.m, 0)}%` : '—'}
                          </td>
                          <td className="num" style={{ whiteSpace: 'nowrap' }}>
                            <Link className="btn sec mini" href={`/app/talhoes/${x.talhao.id}/editar`}>editar</Link>{' '}
                            {x.ultima
                              ? <Link className="btn sec mini" href={`/app/analises/${x.ultima.id}`}>abrir</Link>
                              : <Link className="btn sec mini" href="/app/analises/nova">análise</Link>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Cartao>
            );
          })
        )}

        <Cartao olho="Cadastro" titulo="Novo talhão" style={{ marginTop: 14 }}>
          {propriedades.length === 0 ? (
            <p className="nota">Cadastre uma propriedade primeiro (aba Propriedades).</p>
          ) : (
            <form action={salvarTalhao} className="grade g2">
              <input type="hidden" name="produtor_id" value={id} />
              <div className="campo">
                <label htmlFor="t_prop">Propriedade</label>
                <select id="t_prop" name="propriedade_id" required defaultValue="">
                  <option value="" disabled>selecione…</option>
                  {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
        </Cartao>
      </>
    )
  );
}
