/** Barra de progresso de curso (0 a 100). O texto fica para quem não enxerga a barra. */
export function BarraProgresso({ percentual, rotulo }: { percentual: number; rotulo?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percentual)));
  return (
    <div className="ac-progresso" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo ?? `${p}% concluído`}>
      <i style={{ width: `${p}%` }} />
    </div>
  );
}
