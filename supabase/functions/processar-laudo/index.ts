// Edge Function: processar-laudo
// Disparada por webhook do insert em agro.documentos (status='recebido').
// Pipeline (doc §8.1):
//   baixa PDF -> extrai texto -> detecta laboratório -> perfil de parsing ->
//   normalização por LLM se preciso -> sanidade -> grava payload, status='revisao'
//
// Este arquivo é o esqueleto real do pipeline. As partes marcadas TODO dependem
// de credenciais e de casos de laudo reais anonimizados (ver AUDITORIA-02 §Pendências).

import { extrairDeTexto } from '@agrotech/agro-core/parsers';
import { cors, json } from '../_shared/cors.ts';
import { clienteServico, equipeAutorizada, identificar } from '../_shared/autorizacao.ts';
import { ehUuid, segredoConfere } from '../_shared/seguranca.ts';

// Esta função roda com a service_role (ignora a RLS). Só entra quem:
//   a) traz o segredo interno (webhook do banco) em x-webhook-secret — PROCESSAR_LAUDO_SEGREDO, mín. 16 caracteres; ou
//   b) é da equipe do escritório DONO do documento, com permissão de editar a carteira (perfil ativo).
// Documento já confirmado não é reprocessado (não sobrescreve o que o técnico conferiu).
const segredoInterno = Deno.env.get('PROCESSAR_LAUDO_SEGREDO');
const REPROCESSAVEIS = new Set(['recebido', 'erro', 'revisao']);

interface Evento {
  documento_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const interno = segredoConfere(req.headers.get('x-webhook-secret'), segredoInterno);
  const quem = interno ? null : await identificar(req);
  if (quem && !quem.ok) return quem.resposta;

  const { documento_id } = (await req.json().catch(() => ({}))) as Partial<Evento>;
  if (!ehUuid(documento_id)) return json({ erro: 'documento_id inválido' }, 400);
  const db = clienteServico();

  const { data: doc, error } = await db
    .schema('agro')
    .from('documentos')
    .select('*')
    .eq('id', documento_id)
    .single();

  // mesma resposta para "não existe" e "não é seu": não revela quais ids existem
  if (error || !doc) return json({ erro: 'documento não encontrado' }, 404);
  if (quem?.ok && !(await equipeAutorizada(quem, doc.org_id as string, 'carteira.editar'))) {
    return json({ erro: 'documento não encontrado' }, 404);
  }
  if (!REPROCESSAVEIS.has(String(doc.status))) return json({ erro: `documento em "${doc.status}" não pode ser reprocessado` }, 409);

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
