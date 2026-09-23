'use server';

import { redirect } from 'next/navigation';
import { extrairDeTexto } from '@agrotech/agro-core/parsers';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload do laudo + extração síncrona. Faz localmente (no server action) o que
 * a Edge Function `processar-laudo` faz de forma assíncrona no hospedado — as
 * duas chamam o mesmo parser de `@agrotech/agro-core/parsers`, então o
 * resultado é idêntico; aqui só não depende de webhook configurado.
 */
export async function enviarLaudo(fd: FormData) {
  const arquivo = fd.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error('Selecione um arquivo PDF.');
  if (arquivo.type && arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Envie um arquivo PDF.');
  }

  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem organização.');

  const arrayBuf = await arquivo.arrayBuffer();
  const buf = new Uint8Array(arrayBuf);
  const hash = await sha256Hex(arrayBuf);
  const sb = await criarClienteServidor();

  // dedup: mesmo PDF já enviado nesta organização -> não reprocessa
  const { data: existente } = await sb
    .schema('agro').from('documentos')
    .select('id').eq('org_id', perfil.org_id).eq('hash_sha256', hash).maybeSingle();
  if (existente) redirect(`/app/laudos/${existente.id}`);

  const caminho = `${perfil.org_id}/_/${crypto.randomUUID()}.pdf`;
  const { error: eUpload } = await sb.storage.from('laudos').upload(caminho, buf, { contentType: 'application/pdf' });
  if (eUpload) throw new Error('Falha no upload: ' + eUpload.message);

  const { data: doc, error: eInsert } = await sb
    .schema('agro').from('documentos')
    .insert({
      org_id: perfil.org_id,
      enviado_por: perfil.id,
      storage_path: caminho,
      nome_arquivo: arquivo.name,
      hash_sha256: hash,
      status: 'extraindo',
    })
    .select('id').single();
  if (eInsert) throw new Error(eInsert.message);

  await registrar(sb, {
    acao: 'laudo.enviado', entidade: 'documentos', entidade_id: doc.id,
    org_id: perfil.org_id, dados: { nome_arquivo: arquivo.name },
  });

  try {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = Array.isArray(text) ? text.join('\n') : text;

    if (texto.trim().length < 200) {
      // PDF sem texto nativo (provável digitalizado) — sem OCR configurado,
      // cai para conferência manual (doc §8.2)
      await sb.schema('agro').from('documentos').update({
        status: 'revisao',
        texto_extraido: texto,
        erro: 'PDF digitalizado (sem texto nativo) — lance os valores manualmente na conferência.',
      }).eq('id', doc.id);
    } else {
      const extracao = extrairDeTexto(texto);
      await sb.schema('agro').from('documentos').update({
        status: 'revisao',
        laboratorio: extracao.laboratorio,
        texto_extraido: texto,
        payload: extracao,
        confianca_media: extracao.confianca_media,
        processado_em: new Date().toISOString(),
      }).eq('id', doc.id);
    }
  } catch (e) {
    await sb.schema('agro').from('documentos').update({
      status: 'erro', erro: String((e as Error)?.message ?? e),
    }).eq('id', doc.id);
  }

  redirect(`/app/laudos/${doc.id}`);
}
