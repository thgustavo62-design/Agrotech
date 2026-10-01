import { PADRAO, f2, validarCultura } from '@agrotech/agro-core';
import { Cartao } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { salvarCultura, restaurarCultura } from './acoes';

export const dynamic = 'force-dynamic';

export default async function TabelasConsultor() {
  const sb = await criarClienteServidor();
  const { culturas, fosforo } = await tabelasDaOrg(sb);
  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Base técnica"
        titulo="Tabelas de referência"
        descricao="Valores de literatura (5ª Aproximação/MG + Incaper/ES) como ponto de partida. Cada escritório calibra a própria cópia."
        tags={['Literatura', 'Calibração', 'Referência']}
      />

      <div className="aviso" style={{ marginBottom: 14 }}>
        O app calcula, o agrônomo decide. Toda recomendação sai com a sua assinatura e CREA — confira dose,
        fonte e época antes de entregar ao produtor.
      </div>

      <Cartao olho="Doses de referência" titulo="Adubação por cultura">
        <p className="nota" style={{ marginTop: 0 }}>
          Esta é a cópia do seu escritório. Ajuste as doses à sua realidade; recomendações já emitidas
          não mudam (cada uma guarda o snapshot das tabelas que usou).
        </p>
        {Object.entries(culturas).map(([chave, cult]) => {
          const alterada = JSON.stringify(cult) !== JSON.stringify(PADRAO.culturas[chave]);
          const { avisos } = validarCultura(cult);
          return (
            <details key={chave} style={{ borderTop: '1px solid var(--linha)', padding: '8px 0' }}>
              <summary style={{ cursor: 'pointer' }}>
                <strong>{cult.nome}</strong> <small className="nota">{cult.un} · ref. {cult.ref}</small>
                {alterada ? <span className="chip" style={{ marginLeft: 8 }}>ajustada</span> : null}
              </summary>
              <form action={salvarCultura} className="grade g2" style={{ marginTop: 10 }}>
                <input type="hidden" name="chave" value={chave} />
                <Num id={`${chave}-ref`} nome="ref" rotulo={`Produtividade de referência (${cult.un})`} v={cult.ref} />
                <Num id={`${chave}-V2`} nome="V2" rotulo="V% desejado" v={cult.V2} />
                <Num id={`${chave}-m`} nome="m_max" rotulo="m% máximo" v={cult.m_max} />
                <Num id={`${chave}-N`} nome="N" rotulo="N (kg/ha)" v={cult.N} />
                <Doses chave={chave} prefixo="P" rotulo="P₂O₅ (kg/ha)" v={cult.P} />
                <Doses chave={chave} prefixo="K" rotulo="K₂O (kg/ha)" v={cult.K} />
                {avisos.map((a) => <div key={a} className="aviso" style={{ gridColumn: '1 / -1' }}>{a}</div>)}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button className="btn verde" type="submit">Salvar {cult.nome}</button>
                  {alterada ? (
                    <button className="btn sec" type="submit" formAction={restaurarCultura} formNoValidate>
                      Restaurar literatura
                    </button>
                  ) : null}
                </div>
              </form>
            </details>
          );
        })}
      </Cartao>

      <Cartao olho="Interpretação" titulo="Fósforo por classe de argila (Mehlich-1)">
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Argila</th><th className="num">MB até</th><th className="num">B até</th><th className="num">M até</th><th className="num">Bom até</th></tr>
            </thead>
            <tbody>
              {fosforo.map((x) => (
                <tr key={x.argila}>
                  <td>{x.argila}</td>
                  {x.q.map((q, i) => <td key={i} className="num">{f2(q)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}

function Num({ id, nome, rotulo, v }: { id: string; nome: string; rotulo: string; v: number }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} name={nome} type="number" step="any" min="0" defaultValue={v} required />
    </div>
  );
}

function Doses({ chave, prefixo, rotulo, v }: { chave: string; prefixo: string; rotulo: string; v: number[] }) {
  const classes = ['MB', 'B', 'M', 'Bom', 'MBom'];
  return (
    <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0, gridColumn: '1 / -1' }}>
      <legend>{rotulo} por classe do solo</legend>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {classes.map((c, i) => (
          <label key={c} style={{ flex: '1 1 70px' }}>
            <small className="nota">{c}</small>
            <input name={`${prefixo}${i}`} id={`${chave}-${prefixo}${i}`} type="number" step="any" min="0" defaultValue={v[i]} required />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
