import type { SupabaseClient } from '@supabase/supabase-js';
import { extrairDeLeiturasOcr } from '@agrotech/agro-core/parsers';
import { lerPdfEscaneado, ORCAMENTO_OCR_MS } from '@/lib/ocr-pdf';

/** Folga além do orçamento do OCR antes de desistir: ainda sobra tempo na função para gravar o erro. */
const LIMITE_TOTAL_MS = ORCAMENTO_OCR_MS + 12_000;

/**
 * OCR de um laudo escaneado, chamado em segundo plano (`after`) logo depois do upload.
 * Nunca lança e nunca fica pendurado: o que der errado (inclusive travar) vira `status = 'revisao'` com a mensagem
 * em `erro`, e o consultor lança os valores à mão na conferência — o mesmo caminho de antes do OCR.
 */
export async function processarLaudoEscaneado(sb: SupabaseClient, documentoId: string, pdf: Uint8Array): Promise<void> {
  const doc = sb.schema('agro').from('documentos');
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    const travou = new Promise<never>((_, rejeitar) => {
      relogio = setTimeout(() => rejeitar(new Error('a leitura demorou demais')), LIMITE_TOTAL_MS);
    });
    const leituras = await Promise.race([lerPdfEscaneado(pdf), travou]);
    const extracao = extrairDeLeiturasOcr(leituras);
    const lido = extracao.confianca_media > 0;
    await doc.update({
      status: 'revisao',
      laboratorio: extracao.laboratorio,
      texto_extraido: leituras[0] ?? '',
      payload: extracao,
      confianca_media: extracao.confianca_media,
      processado_em: new Date().toISOString(),
      erro: lido ? null : 'O OCR não conseguiu ler os valores deste PDF — lance-os manualmente na conferência.',
    }).eq('id', documentoId);
  } catch (e) {
    await doc.update({
      status: 'revisao',
      erro: `OCR falhou (${String((e as Error)?.message ?? e)}) — lance os valores manualmente na conferência.`,
    }).eq('id', documentoId);
  } finally {
    clearTimeout(relogio);
  }
}
