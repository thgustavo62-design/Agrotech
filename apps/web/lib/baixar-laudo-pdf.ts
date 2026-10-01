'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario } from '@/lib/acao';

/** Pede à Edge Function `gerar-laudo-pdf` o PDF da recomendação (gera na primeira vez,
 *  depois reaproveita) e redireciona para o link assinado. A função confere se o
 *  usuário é consultor da org dona do laudo ou o próprio produtor. */
async function baixarLaudoPdfImpl(fd: FormData) {
  const recomendacao_id = String(fd.get('recomendacao_id') ?? '');
  if (!recomendacao_id) throw new ErroDeUsuario('laudo não informado');

  const sb = await criarClienteServidor();
  const { data, error } = await sb.functions.invoke<{ url?: string }>('gerar-laudo-pdf', {
    body: { recomendacao_id },
  });

  if (error || !data?.url) {
    let motivo = error?.message ?? 'resposta sem link';
    const resposta = (error as { context?: Response } | null)?.context;
    if (resposta && typeof resposta.json === 'function') {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      if (corpo?.erro) motivo = corpo.erro;
    }
    throw new ErroDeUsuario(`Não foi possível gerar o PDF: ${motivo}`);
  }
  redirect(data.url);
}

export const baixarLaudoPdf = comAviso(baixarLaudoPdfImpl);
