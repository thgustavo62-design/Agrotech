/**
 * Esqueleto de carregamento: o formato genérico de uma tela (banner, indicadores, lista).
 * Aparece NA HORA ao navegar (loading.tsx) enquanto o servidor monta a página de verdade —
 * sem ele a tela ficava parada no que estava antes até a resposta chegar, o que dá a
 * impressão de lentidão mesmo quando o tempo total não mudou.
 */
export function EsqueletoPagina({ indicadores = 4, linhas = 4 }: { indicadores?: number; linhas?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando">
      <div className="esq esq-banner" />
      <div className="grade g4" style={{ marginBottom: 14 }}>
        {Array.from({ length: indicadores }, (_, i) => <div key={i} className="esq esq-metrica" />)}
      </div>
      <div className="lista">
        {Array.from({ length: linhas }, (_, i) => <div key={i} className="esq esq-linha" />)}
      </div>
      <span className="so-leitor">Carregando…</span>
    </div>
  );
}
