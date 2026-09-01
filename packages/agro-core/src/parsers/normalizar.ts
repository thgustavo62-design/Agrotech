import type { ChaveCampoLaudo, CampoExtraido } from './tipos.js';

/**
 * Normalização por LLM — usada só quando o parser declarativo não resolve.
 *
 * Duas travas OBRIGATÓRIAS (doc seção 8.5):
 *   1. resultado do LLM nunca entra com confiança acima de 0,65
 *   2. resultado do LLM nunca pula a tela de conferência
 *
 * Este módulo é puro: recebe uma função `chamar` que faz o HTTP. A Edge Function
 * injeta a implementação real; os testes injetam um mock.
 */

export const CONFIANCA_MAX_LLM = 0.65;

export const ESQUEMA_LAUDO: ChaveCampoLaudo[] = [
  'argila', 'ph', 'mo', 'p', 'k', 'na', 'ca', 'mg', 'al', 'h_al',
  's', 'b', 'zn', 'cu', 'mn', 'fe',
];

export interface PromptLLM {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user'; content: string }[];
}

export function montarPrompt(texto: string, modelo = 'claude-sonnet-4-6'): PromptLLM {
  return {
    model: modelo,
    max_tokens: 1500,
    system:
      'Você extrai dados de laudos de análise de solo brasileiros. ' +
      'Responda SOMENTE com JSON válido, sem markdown, sem explicação. ' +
      'Use null para campo ausente. Converta vírgula decimal em ponto. ' +
      'Nunca invente valor que não esteja no texto.',
    messages: [
      { role: 'user', content: `Esquema (chaves): ${JSON.stringify(ESQUEMA_LAUDO)}\n\nLaudo:\n${texto}` },
    ],
  };
}

/** Lê o JSON devolvido pelo LLM e o converte em campos com confiança limitada. */
export function interpretarResposta(
  respostaJson: string,
): Partial<Record<ChaveCampoLaudo, CampoExtraido>> {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(respostaJson) as Record<string, unknown>;
  } catch {
    return {};
  }

  const out: Partial<Record<ChaveCampoLaudo, CampoExtraido>> = {};
  for (const chave of ESQUEMA_LAUDO) {
    const v = obj[chave];
    if (v == null) continue;
    const num = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(',', '.'));
    if (!Number.isFinite(num)) continue;
    out[chave] = {
      valor: num,
      confianca: CONFIANCA_MAX_LLM,
      origem: 'normalização por LLM (requer conferência)',
    };
  }
  return out;
}

/** Orquestra: monta prompt -> chama -> interpreta. `chamar` faz o HTTP real. */
export async function normalizarComLLM(
  texto: string,
  chamar: (p: PromptLLM) => Promise<string>,
  modelo?: string,
): Promise<Partial<Record<ChaveCampoLaudo, CampoExtraido>>> {
  const resposta = await chamar(montarPrompt(texto, modelo));
  return interpretarResposta(resposta);
}
