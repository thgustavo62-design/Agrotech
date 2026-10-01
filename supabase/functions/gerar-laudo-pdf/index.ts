// Edge Function: gerar-laudo-pdf
// Recebe uma recomendação já gravada, renderiza o laudo em PDF e salva em
// recomendacoes/{org_id}/{produtor_id}/{uuid}.pdf, gravando pdf_path.
//
// O conteúdo do laudo vem 100% de agro.recomendacoes.resultado (que carrega
// motor_versao + tabelas_snapshot) — nada é recalculado aqui, para o PDF bater
// sempre com o que foi emitido. A renderização mora em @agrotech/laudo-pdf
// (testada em Node); esta função só autoriza, busca, grava e devolve o link.
//
// Chamada: POST { recomendacao_id } com o JWT do usuário logado (consultor da
// org dona da recomendação, ou o próprio produtor dono do laudo). Resposta:
// { ok, pdf_path, url } — `url` é assinada e vale 5 minutos.

import { createClient } from '@supabase/supabase-js';
import { renderizarLaudoPdf, type ResultadoLaudo } from '@agrotech/laudo-pdf';
import { cors, json } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Corpo {
  recomendacao_id?: string;
}

interface Produtor {
  id: string;
  org_id: string;
  user_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const corpo = (await req.json().catch(() => ({}))) as Corpo;
  if (!corpo.recomendacao_id) return json({ erro: 'recomendacao_id é obrigatório' }, 400);

  const db = createClient(supabaseUrl, serviceRole);

  // Quem está chamando. A service role ignora a RLS, então a autorização é daqui.
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const { data: sessao } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
  const usuario = sessao.user;
  if (!usuario) return json({ erro: 'não autenticado' }, 401);

  const { data: rec, error } = await db
    .schema('agro')
    .from('recomendacoes')
    .select(
      'id, resultado, pdf_path, emitida_em, analise:analise_id(talhao:talhao_id(propriedade:propriedade_id(produtor:produtor_id(id, org_id, user_id))))',
    )
    .eq('id', corpo.recomendacao_id)
    .single();
  if (error || !rec) return json({ erro: 'recomendação não encontrada' }, 404);

  // deno-lint-ignore no-explicit-any
  const produtor = (rec as any).analise?.talhao?.propriedade?.produtor as Produtor | undefined;
  if (!produtor) return json({ erro: 'recomendação sem produtor associado' }, 422);

  const { data: perfil } = await db.schema('agro').from('profiles').select('org_id, role').eq('id', usuario.id).maybeSingle();
  const consultorDaOrg = perfil?.org_id === produtor.org_id && (perfil?.role === 'consultor' || perfil?.role === 'admin');
  const proprioProdutor = produtor.user_id === usuario.id;
  if (!consultorDaOrg && !proprioProdutor) return json({ erro: 'sem permissão' }, 403);

  // O resultado é imutável: se o PDF já existe, só devolve o link.
  let caminho = rec.pdf_path as string | null;
  if (!caminho) {
    const bytes = await renderizarLaudoPdf(rec.resultado as ResultadoLaudo, rec.emitida_em as string);
    caminho = `${produtor.org_id}/${produtor.id}/${crypto.randomUUID()}.pdf`;

    const { error: eUp } = await db.storage.from('recomendacoes').upload(caminho, bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (eUp) return json({ erro: `falha ao gravar o PDF: ${eUp.message}` }, 500);

    const { error: eRec } = await db.schema('agro').from('recomendacoes').update({ pdf_path: caminho }).eq('id', rec.id);
    if (eRec) {
      await db.storage.from('recomendacoes').remove([caminho]);
      return json({ erro: `falha ao registrar o PDF: ${eRec.message}` }, 500);
    }
  }

  const { data: link, error: eLink } = await db.storage.from('recomendacoes').createSignedUrl(caminho, 300, {
    download: 'laudo-agrotech.pdf',
  });
  if (eLink || !link) return json({ erro: 'PDF gerado, mas não foi possível criar o link' }, 500);

  return json({ ok: true, pdf_path: caminho, url: link.signedUrl });
});
