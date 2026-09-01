// Edge Function: gerar-laudo-pdf
// Recebe uma recomendação já gravada, renderiza o laudo em PDF e salva em
// recomendacoes/{org_id}/{produtor_id}/{uuid}.pdf, gravando pdf_path.
//
// O conteúdo do laudo vem 100% de agro.recomendacoes.resultado (que carrega
// motor_versao + tabelas_snapshot) — nada é recalculado aqui, para o PDF bater
// sempre com o que foi emitido.

import { createClient } from '@supabase/supabase-js';
import { cors, json } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Corpo {
  recomendacao_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const { recomendacao_id } = (await req.json()) as Corpo;
  const db = createClient(supabaseUrl, serviceRole);

  const { data: rec, error } = await db
    .schema('agro')
    .from('recomendacoes')
    .select('id, resultado, analise:analise_id(talhao:talhao_id(propriedade:propriedade_id(produtor:produtor_id(id, org_id))))')
    .eq('id', recomendacao_id)
    .single();

  if (error || !rec) return json({ erro: 'recomendação não encontrada' }, 404);

  // TODO: renderização real. Opções avaliadas: @react-pdf/renderer (Deno via esm.sh)
  // ou HTML -> print via serviço headless. Mantém o layout .folha-a4 do protótipo.
  const html = montarHtmlLaudo(rec.resultado);
  const pdfBytes = new TextEncoder().encode(html); // placeholder

  // deno-lint-ignore no-explicit-any
  const prod = (rec as any).analise?.talhao?.propriedade?.produtor;
  const caminho = `${prod?.org_id}/${prod?.id}/${crypto.randomUUID()}.pdf`;

  await db.storage.from('recomendacoes').upload(caminho, pdfBytes, {
    contentType: 'application/pdf',
    upsert: false,
  });
  await db.schema('agro').from('recomendacoes').update({ pdf_path: caminho }).eq('id', recomendacao_id);

  return json({ ok: true, pdf_path: caminho, provisorio: true });
});

function montarHtmlLaudo(resultado: unknown): string {
  return `<!doctype html><meta charset="utf-8"><title>Laudo AgroTech</title>` +
    `<pre>${JSON.stringify(resultado, null, 2)}</pre>`;
}
