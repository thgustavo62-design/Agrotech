import type { SupabaseClient } from '@supabase/supabase-js';
import { extrairDeLeiturasOcr } from '@agrotech/agro-core/parsers';
import { lerPdfEscaneado } from '@/lib/ocr-pdf';

/**
 * OCR de um laudo escaneado, chamado em segundo plano (`after`) logo depois do upload.
 * Nunca lança: o que der errado vira `status = 'revisao'` com a mensagem em `erro`, e o
 * consultor lança os valores à mão na conferência — o mesmo caminho de antes do OCR.
 */
export async function processarLaudoEscaneado(sb: SupabaseClient, documentoId: string, pdf: Uint8Array): Promise<void> {
  const doc = sb.schema('agro').from('documentos');
  try {
    const leituras = await lerPdfEscaneado(pdf);
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
  }
}
