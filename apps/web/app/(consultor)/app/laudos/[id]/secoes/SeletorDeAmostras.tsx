import Link from 'next/link';
import type { AmostraExtraida } from '@/lib/laudo-conferencia';

/** Laudo em tabela com várias amostras: cada uma vira uma análise, confirmada uma por vez. */
export function SeletorDeAmostras({
  id, amostras, atual, confirmadas,
}: {
  id: string;
  amostras: AmostraExtraida[];
  atual: AmostraExtraida | undefined;
  confirmadas: Set<number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
      <span className="nota">Este laudo tem {amostras.length} amostras — cada uma vira uma análise:</span>
      {amostras.map((a) => (
        <Link
          key={a.indice}
          href={`/app/laudos/${id}?amostra=${a.indice}`}
          className={`btn mini ${a.indice === atual?.indice ? 'verde' : 'sec'}`}
        >
          {confirmadas.has(a.indice) ? '✓ ' : ''}{a.rotulo ?? `Amostra ${a.indice}`}
        </Link>
      ))}
    </div>
  );
}
