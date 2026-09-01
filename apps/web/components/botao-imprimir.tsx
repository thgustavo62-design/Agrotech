'use client';

export function BotaoImprimir() {
  return (
    <button className="btn verde nao-imprime" type="button" onClick={() => window.print()}>
      Imprimir / PDF
    </button>
  );
}
