import type { Analise, ResultadoCalculo } from '@agrotech/agro-core';
import { n } from '@agrotech/agro-core';
import { f } from '@/lib/formato';

/**
 * Ocupação da CTC. Auditoria A5: o Al NÃO é segmento próprio — ele aparece como
 * a fração avermelhada dentro do segmento de H+Al (que já o contém).
 */
export function PerfilCTC({ analise, calc }: { analise: Analise; calc: ResultadoCalculo }) {
  const Al = n(analise.Al);
  const HAl = n(analise.HAl);
  const Ca = n(analise.Ca);
  const Mg = n(analise.Mg);
  const K = calc.Kc;
  const tot = Ca + Mg + K + HAl;
  if (tot <= 0) return null;

  const p = (v: number) => (100 * v) / tot;
  const fracAl = HAl > 0 ? Math.min(100, (100 * Al) / HAl) : 0;
  const corHAl = `linear-gradient(90deg, var(--al) 0 ${fracAl}%, var(--hal) ${fracAl}% 100%)`;

  const seg = (v: number, cor: string, chave: string) => (
    <div key={chave} style={{ background: cor, flex: `0 0 ${p(v)}%` }}>
      {p(v) >= 6 ? `${f(p(v), 0)}%` : ''}
    </div>
  );

  return (
    <>
      <div className="perfil">
        {seg(Ca, 'var(--ca)', 'ca')}
        {seg(Mg, 'var(--mg)', 'mg')}
        {seg(K, 'var(--k)', 'k')}
        {seg(HAl, corHAl, 'hal')}
      </div>
      <div className="legenda">
        <span><i style={{ background: 'var(--ca)' }} />Ca {f(p(Ca), 0)}% <em className="nota">(ideal 50–60)</em></span>
        <span><i style={{ background: 'var(--mg)' }} />Mg {f(p(Mg), 0)}% <em className="nota">(ideal 15–20)</em></span>
        <span><i style={{ background: 'var(--k)' }} />K {f(p(K), 1)}% <em className="nota">(ideal 3–5)</em></span>
        <span><i style={{ background: 'var(--hal)' }} />H+Al {f(p(HAl), 0)}%</span>
        <span><i style={{ background: 'var(--al)' }} />Al {f(Al, 2)} cmolc – m {f(calc.m, 0)}% <em className="nota">(parte do H+Al)</em></span>
      </div>
    </>
  );
}
