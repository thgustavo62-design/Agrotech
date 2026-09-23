'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

/** Edita o próprio perfil do consultor — coberto pela policy profiles_atualiza_proprio. */
export async function salvarPerfilConsultor(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) throw new Error('sessão inválida');

  const nome = String(fd.get('nome') ?? '').trim();
  if (!nome) throw new Error('Informe seu nome.');

  const dados = {
    nome,
    crea: String(fd.get('crea') ?? '').trim() || null,
    art: String(fd.get('art') ?? '').trim() || null,
    fone: String(fd.get('fone') ?? '').trim() || null,
  };

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('profiles').update(dados).eq('id', perfil.id);
  if (error) throw new Error(error.message);

  await registrar(sb, {
    acao: 'perfil.editado', entidade: 'profiles', entidade_id: perfil.id, org_id: perfil.org_id,
  });
  revalidatePath('/app/config');
}
