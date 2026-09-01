import { classificar, NOMES_CLASSE, NOMES_INV } from '@agrotech/agro-core';
import { f } from '@/lib/formato';

const CORES = ['var(--c-mb)', 'var(--c-b)', 'var(--c-m)', 'var(--c-bom)', 'var(--c-mbom)'];
const CORES_INV = ['var(--c-mbom)', 'var(--c-bom)', 'var(--c-m)', 'var(--c-b)', 'var(--c-mb)'];
const COR_CURTA: Record<string, string> = {
  mb: 'var(--c-mb)', b: 'var(--c-b)', m: 'var(--c-m)', bom: 'var(--c-bom)', mbom: 'var(--c-mbom)',
};

export interface ReguaProps {
  rotulo: string;
  unidade: string;
  valor: number;
  quebras: [number, number, number, number] | null;
  invertido?: boolean;
  nomes?: readonly string[];
  cores?: readonly string[];
}

/**
 * Elemento-assinatura da UI: régua de 5 classes com o marcador do valor medido.
 * Porta direta de regua() do protótipo — corrigido para aceitar escala e cores
 * próprias por parâmetro (auditoria A4: o pH usa a dele).
 */
export function ReguaInterpretacao({
  rotulo, unidade, valor, quebras, invertido = false, nomes, cores,
}: ReguaProps) {
  if (!quebras) return null;

  const i = classificar(valor, quebras);
  const rotulos = nomes ?? (invertido ? NOMES_INV : NOMES_CLASSE);
  const paleta =
    cores && cores.length === 5
      ? cores.map((c) => COR_CURTA[c] ?? c)
      : invertido ? CORES_INV : CORES;

  const lo = i === 0 ? 0 : quebras[i - 1]!;
  const hi = i === 4 ? quebras[3] * 1.6 : quebras[i]!;
  const frac = hi > lo ? Math.min(1, Math.max(0, (valor - lo) / (hi - lo))) : 0.5;
  const pos = Math.min(99.5, i * 20 + frac * 20);

  return (
    <div className="regua-linha">
      <div className="regua-nome">
        {rotulo}
        <small>{unidade || ' '}</small>
      </div>
      <div className="regua-valor">{f(valor, valor < 10 ? 2 : 0)}</div>
      <div className="regua">
        <div className="regua-classe" style={{ color: paleta[i] }}>{rotulos[i]}</div>
        <div className="faixas">
          {paleta.map((c, k) => (
            <i key={k} style={{ background: c, opacity: k === i ? 1 : 0.28 }} />
          ))}
        </div>
        <div className="marca-valor" style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}
