'use server';

import { criarClienteServidor } from '@/lib/supabase/server';

export type ResultadoBusca = { grupo: string; rotulo: string; detalhe?: string; href: string };

/** `%` e `_` digitados pelo usuário não podem virar curinga do ilike. */
const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Busca global (Ctrl/Cmd+K). Roda no servidor, com a sessão já renovada pelo middleware:
 * antes usava um segundo cliente de autenticação no navegador, que guarda o próprio
 * refresh token e podia disputá-lo com o servidor. A RLS continua sendo quem restringe.
 * Devolve dados (é chamada direto pelo cliente), por isso não usa comAviso.
 */
export async function buscarGlobal(termo: string): Promise<ResultadoBusca[]> {
  const q = termo.trim().slice(0, 60);
  if (q.length < 2) return [];
  const padrao = `%${escaparLike(q)}%`;

  const sb = await criarClienteServidor();
  const [{ data: produtores }, { data: propriedades }, { data: talhoes }] = await Promise.all([
    sb.schema('agro').from('produtores').select('id, nome').ilike('nome', padrao).limit(5),
    sb.schema('agro').from('propriedades').select('id, nome, produtor:produtor_id(id, nome)').ilike('nome', padrao).limit(5),
    sb.schema('agro').from('talhoes').select('id, nome, cultura, propriedade:propriedade_id(produtor:produtor_id(nome))').ilike('nome', padrao).limit(5),
  ]);

  return [
    ...(produtores ?? []).map((p) => ({ grupo: 'Produtores', rotulo: p.nome as string, href: `/app/produtores/${p.id}` })),
    ...(propriedades ?? []).map((p) => {
      // deno-lint-ignore no-explicit-any
      const dono = (p as any).produtor as { id?: string; nome?: string } | null;
      return { grupo: 'Propriedades', rotulo: p.nome as string, detalhe: dono?.nome, href: `/app/produtores/${dono?.id ?? ''}` };
    }),
    ...(talhoes ?? []).map((t) => ({
      grupo: 'Talhões', rotulo: t.nome as string,
      // deno-lint-ignore no-explicit-any
      detalhe: (t as any).propriedade?.produtor?.nome as string | undefined, href: `/app/talhoes/${t.id}`,
    })),
  ];
}
