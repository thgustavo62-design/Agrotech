import { Grade } from '@/components/ui';
import type { AmostraExtraida, Extracao } from '@/lib/laudo-conferencia';

/** Indicadores do topo: confiança média, laboratório, protocolo e a amostra em conferência. */
export function ResumoDoLaudo({ extracao, atual }: { extracao: Extracao; atual: AmostraExtraida | undefined }) {
  const ident = extracao.identificacao ?? {};
  return (
    <Grade cols={4} style={{ marginBottom: 14 }}>
      <div className="metrica"><span>Confiança média</span><b>{Math.round((extracao.confianca_media ?? 0) * 100)}%</b></div>
      <div className="metrica"><span>Laboratório</span><b style={{ fontSize: 15 }}>{extracao.laboratorio ?? '—'}</b></div>
      <div className="metrica"><span>Protocolo</span><b style={{ fontSize: 15 }}>{ident.protocolo ?? '—'}</b></div>
      <div className="metrica"><span>Amostra</span><b style={{ fontSize: 15 }}>{atual?.rotulo ?? ident.amostra ?? '—'}</b></div>
    </Grade>
  );
}
