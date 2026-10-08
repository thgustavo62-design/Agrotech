/**
 * Camada amostrada × o que a metodologia permite.
 *
 * Calagem e adubação (5ª Aproximação/MG, Incaper/ES) são calibradas para a camada 0-20 cm. Amostra de 20-40 cm é
 * subsuperfície: serve para decidir GESSAGEM e não para calcular calcário/adubo; amostra 0-40 cm é uma composta
 * que mistura as duas e não corresponde às tabelas. Calcular assim "adaptando em silêncio" daria uma dose
 * com cara de precisa e base errada — por isso a emissão é recusada com a explicação.
 */

export type Camada = '0-20' | '20-40' | '0-40';

/** "0-20", "0–20 cm", "0 - 20cm" → '0-20'. Qualquer outra coisa → null (não adivinhar). */
export function normalizarCamada(v: unknown): Camada | null {
  const s = String(v ?? '').toLowerCase().replace(/cm/g, '').replace(/[–—−]/g, '-').replace(/\s+/g, '');
  return s === '0-20' || s === '20-40' || s === '0-40' ? s : null;
}

export type ResultadoCamada = { ok: true; camada: '0-20' } | { ok: false; camada: Camada | null; mensagem: string };

export function validarCamadaParaRecomendar(profundidade: unknown): ResultadoCamada {
  const camada = normalizarCamada(profundidade);
  if (camada === '0-20') return { ok: true, camada };
  if (camada === '20-40') {
    return { ok: false, camada, mensagem: 'Esta amostra é de 20–40 cm (subsuperfície): ela serve para avaliar a gessagem da amostra de 0–20 cm e não gera calagem nem adubação. Emita a recomendação pela análise de 0–20 cm.' };
  }
  if (camada === '0-40') {
    return { ok: false, camada, mensagem: 'Amostra de 0–40 cm é composta e não corresponde às tabelas de recomendação, calibradas para 0–20 cm. Colete 0–20 cm (e 20–40 cm se houver suspeita de alumínio ou pouco cálcio em profundidade).' };
  }
  return { ok: false, camada: null, mensagem: `Profundidade de coleta "${String(profundidade ?? '')}" não reconhecida. Use 0–20, 20–40 ou 0–40 cm.` };
}
