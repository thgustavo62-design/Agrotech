// Edge Function: processar-laudo
// Disparada por webhook do insert em agro.documentos (status='recebido').
// Pipeline (doc §8.1):
//   baixa PDF -> extrai texto -> detecta laboratório -> perfil de parsing ->
//   normalização por LLM se preciso -> sanidade -> grava payload, status='revisao'
//
// Este arquivo é o esqueleto real do pipeline. As partes marcadas TODO dependem
// de credenciais e de casos de laudo reais anonimizados (ver AUDITORIA-02 §Pendências).

import { createClient } from '@supabase/supabase-js';
import { extrairDeTexto } from '@agrotech/agro-core/parsers';
import { cors, json } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Evento {
  documento_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const { documento_id } = (await req.json()) as Evento;
  const db = createClient(supabaseUrl, serviceRole);

  const { data: doc, error } = await db
    .schema('agro')
    .from('documentos')
    .select('*')
    .eq('id', documento_id)
    .single();

  if (error || !doc) return json({ erro: 'documento não encontrado' }, 404);

  try {
    await db.schema('agro').from('documentos').update({ status: 'extraindo' }).eq('id', documento_id);

    // 1. baixa o PDF do Storage
    const { data: arquivo } = await db.storage.from('laudos').download(doc.storage_path);
    if (!arquivo) throw new Error('falha ao baixar o PDF do Storage');
    const buffer = new Uint8Array(await arquivo.arrayBuffer());

    // 2. extrai texto nativo (a maioria dos laudos sai de sistema, não de scanner)
    const texto = await extrairTextoPdf(buffer);

    // 3. PDF é imagem -> rota de OCR (opcional por custo). Padrão: revisão manual.
    if (texto.trim().length < 200) {
      await db.schema('agro').from('documentos').update({
        status: 'revisao',
        erro: 'PDF digitalizado (sem texto nativo) — lançar manualmente ou habilitar OCR.',
        texto_extraido: texto,
      }).eq('id', documento_id);
      return json({ status: 'revisao', motivo: 'pdf-imagem' });
    }

    // 4-7. perfil de parsing + sanidade (agro-core, testado)
    const extracao = extrairDeTexto(texto);

    // 6. campos faltando ou confiança baixa -> normalização por LLM
    //    TODO: chamar normalizarComLLM() quando ANTHROPIC_API_KEY estiver setada
    //    e mesclar, sempre com confiança <= 0,65 e sem pular a conferência.

    // 8. grava e manda para a tela de conferência
    await db.schema('agro').from('documentos').update({
      status: 'revisao',
      laboratorio: extracao.laboratorio,
      texto_extraido: texto,
      payload: extracao,
      confianca_media: extracao.confianca_media,
      processado_em: new Date().toISOString(),
    }).eq('id', documento_id);

    return json({ status: 'revisao', confianca_media: extracao.confianca_media, avisos: extracao.avisos });
  } catch (e) {
    await db.schema('agro').from('documentos').update({
      status: 'erro',
      erro: String((e as Error).message ?? e),
    }).eq('id', documento_id);
    return json({ erro: String((e as Error).message ?? e) }, 500);
  }
});

/** Extração de texto nativo com unpdf. Isolada para trocar de lib sem tocar no fluxo. */
async function extrairTextoPdf(buffer: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import('https://esm.sh/unpdf@0.12.1');
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}
