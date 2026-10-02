import { nomeCultura } from '@/lib/culturas';
import { f } from '@/lib/formato';
import { Cartao, Vazio } from '@/components/ui';
import type { ContextoInteligencia } from '../dados';

export function EstimativaPorCultura({ ctx }: { ctx: ContextoInteligencia }) {
  const { resumoCulturas } = ctx;

  return (
    <Cartao olho="Estimativa" titulo="Área, calcário e fertilizante por cultura" style={{ marginTop: 14 }}>
      {resumoCulturas.length === 0 ? (
        <Vazio titulo="Nenhum dado ainda" />
      ) : (
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Cultura</th><th className="num">Área</th><th className="num">Calcário</th>
                <th className="num">Gesso</th><th className="num">N</th><th className="num">P₂O₅</th><th className="num">K₂O</th>
              </tr>
            </thead>
            <tbody>
              {resumoCulturas.map(([c, v]) => (
                <tr key={c}>
                  <td>{nomeCultura(c === '__sem' ? null : c)}</td>
                  <td className="num">{f(v.area, 1)} ha</td>
                  <td className="num">{f(v.calcario, 1)} t</td>
                  <td className="num">{f(v.gesso, 1)} t</td>
                  <td className="num">{f(v.N, 0)} kg</td>
                  <td className="num">{f(v.P2O5, 0)} kg</td>
                  <td className="num">{f(v.K2O, 0)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota" style={{ marginTop: 10 }}>
        Soma dos totais já calculados em cada recomendação emitida (dose/ha × área do talhão) — não é uma
        nova estimativa, é o mesmo número que já está em cada laudo.
      </p>
    </Cartao>
  );
}
