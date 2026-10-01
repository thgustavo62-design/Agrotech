'use server';

import { revalidatePath } from 'next/cache';
import { PADRAO, validarCultura, type Cultura } from '@agrotech/agro-core';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { registrar } from '@/lib/audit';

const num = (v: FormDataEntryValue | null) => Number(String(v ?? '').trim().replace(',', '.'));
const cinco = (fd: FormData, p: string) => [0, 1, 2, 3, 4].map((i) => num(fd.get(`${p}${i}`))) as Cultura['P'];

async function gravarCulturas(culturas: Record<string, Cultura>, acao: string, chave: string) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem escritório associado.');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') throw new Error('Sem permissão.');

  const sb = await criarClienteServidor();
  const { data: atual } = await sb.schema('agro').from('tabelas_referencia')
    .select('versao').eq('org_id', perfil.org_id).eq('tipo', 'culturas').maybeSingle();

  const { error } = await sb.schema('agro').from('tabelas_referencia').upsert(
    { org_id: perfil.org_id, tipo: 'culturas', conteudo: culturas, versao: (atual?.versao ?? 0) + 1 },
    { onConflict: 'org_id,tipo' },
  );
  if (error) throw new Error(error.message);

  await registrar(sb, { acao, entidade: 'tabelas_referencia', org_id: perfil.org_id, dados: { cultura: chave } });
  revalidatePath('/app/tabelas');
}

/** Salva as doses de uma cultura na cópia do escritório. Recomendações já emitidas
 *  não mudam: carregam o próprio tabelas_snapshot. */
export async function salvarCultura(fd: FormData) {
  const chave = String(fd.get('chave') ?? '');
  const base = PADRAO.culturas[chave];
  if (!base) throw new Error('Cultura desconhecida.');

  const editada: Cultura = {
    ...base,
    ref: num(fd.get('ref')),
    V2: num(fd.get('V2')),
    m_max: num(fd.get('m_max')),
    N: num(fd.get('N')),
    P: cinco(fd, 'P'),
    K: cinco(fd, 'K'),
  };
  const { erros } = validarCultura(editada);
  if (erros.length) throw new Error(erros.join(' '));

  const sb = await criarClienteServidor();
  const atuais = (await tabelasDaOrg(sb)).culturas;
  await gravarCulturas({ ...atuais, [chave]: editada }, 'tabela.cultura_editada', chave);
}

/** Volta uma cultura aos valores de literatura. */
export async function restaurarCultura(fd: FormData) {
  const chave = String(fd.get('chave') ?? '');
  const base = PADRAO.culturas[chave];
  if (!base) throw new Error('Cultura desconhecida.');

  const sb = await criarClienteServidor();
  const atuais = (await tabelasDaOrg(sb)).culturas;
  await gravarCulturas({ ...atuais, [chave]: base }, 'tabela.cultura_restaurada', chave);
}
