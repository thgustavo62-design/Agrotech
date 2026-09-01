import { PADRAO, f2 } from '@agrotech/agro-core';
import { CabecalhoVista, Cartao } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** Read-only por enquanto — edição por organização entra na Fase 2. */
export default function TabelasConsultor() {
  const c = PADRAO.culturas;
  return (
    <>
      <CabecalhoVista
        olho="Base técnica"
        titulo="Tabelas de referência"
        descricao="Valores de literatura (5ª Aproximação/MG + Incaper/ES). A edição por organização — cada escritório calibra a própria cópia — entra na Fase 2."
      />

      <div className="aviso" style={{ marginBottom: 14 }}>
        O app calcula, o agrônomo decide. Toda recomendação sai com a sua assinatura e CREA — confira dose,
        fonte e época antes de entregar ao produtor.
      </div>

      <Cartao olho="Doses de referência" titulo="Adubação por cultura">
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Cultura</th><th className="num">Ref.</th><th className="num">V</th>
                <th className="num">N</th><th>P₂O₅</th><th>K₂O</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(c).map((cult) => (
                <tr key={cult.nome}>
                  <td>{cult.nome}<br /><small className="nota">{cult.un}</small></td>
                  <td className="num">{cult.ref}</td>
                  <td className="num">{cult.V2}%</td>
                  <td className="num">{cult.N}</td>
                  <td className="mono">{cult.P.join(', ')}</td>
                  <td className="mono">{cult.K.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao olho="Interpretação" titulo="Fósforo por classe de argila (Mehlich-1)">
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Argila</th><th className="num">MB até</th><th className="num">B até</th><th className="num">M até</th><th className="num">Bom até</th></tr>
            </thead>
            <tbody>
              {PADRAO.fosforo.map((x) => (
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
