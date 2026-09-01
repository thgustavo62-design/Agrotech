import { PADRAO, f2 } from '@agrotech/agro-core';
import { CabecalhoVista, Cartao } from '@/components/ui';

export default function DemoTabelas() {
  const c = PADRAO.culturas;

  return (
    <>
      <CabecalhoVista
        olho="Base técnica"
        titulo="Tabelas de referência"
        descricao="Ponto de partida (5ª Aproximação/MG + Incaper/ES). Cada escritório recebe a própria cópia e calibra — a recomendação segue exatamente o que estiver aqui."
      />

      <Cartao olho="Doses de referência" titulo="Adubação por cultura">
        <p className="nota" style={{ margin: '0 0 12px' }}>
          N em kg/ha na produtividade de referência. P₂O₅ e K₂O em kg/ha por classe do solo, da mais pobre
          para a mais rica.
        </p>
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Cultura</th>
                <th className="num">Produt. ref.</th>
                <th className="num">V desej.</th>
                <th className="num">N</th>
                <th>P₂O₅ (MB→MBom)</th>
                <th>K₂O (MB→MBom)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(c).map((cult) => (
                <tr key={cult.nome}>
                  <td>
                    {cult.nome}
                    <br />
                    <small className="nota">{cult.un}</small>
                  </td>
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
              <tr>
                <th>Argila</th>
                <th className="num">Muito baixo até</th>
                <th className="num">Baixo até</th>
                <th className="num">Médio até</th>
                <th className="num">Bom até</th>
                <th className="num">Acima</th>
              </tr>
            </thead>
            <tbody>
              {PADRAO.fosforo.map((x) => (
                <tr key={x.argila}>
                  <td>{x.argila}</td>
                  {x.q.map((q, i) => (
                    <td key={i} className="num">{f2(q)}</td>
                  ))}
                  <td className="num">Muito bom</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao olho="Fontes" titulo="Fertilizantes e teores de garantia">
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">% N</th>
                <th className="num">% P₂O₅</th>
                <th className="num">% K₂O</th>
                <th>Outros</th>
              </tr>
            </thead>
            <tbody>
              {PADRAO.fertilizantes.map((x) => (
                <tr key={x.nome}>
                  <td>{x.nome}</td>
                  <td className="num">{x.N}</td>
                  <td className="num">{x.P}</td>
                  <td className="num">{x.K}</td>
                  <td className="nota">{x.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}
