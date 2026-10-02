'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

/** Edita o próprio perfil — coberto pela policy profiles_atualiza_proprio; o gatilho (0037) impede mexer em papel/perfis/escritório. */
async function salvarPerfilConsultorImpl(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) throw new ErroDeUsuario('sessão inválida');

  const nome = String(fd.get('nome') ?? '').trim();
  if (!nome) throw new ErroDeUsuario('Informe seu nome.');

  const dados = {
    nome,
    titulo: String(fd.get('titulo') ?? '').trim().slice(0, 60) || null,
    crea: String(fd.get('crea') ?? '').trim() || null,
    art: String(fd.get('art') ?? '').trim() || null,
    fone: String(fd.get('fone') ?? '').trim() || null,
  };

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('profiles').update(dados).eq('id', perfil.id);
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    acao: 'perfil.editado', entidade: 'profiles', entidade_id: perfil.id, org_id: perfil.org_id,
  });
  revalidatePath('/app/config', 'layout');
}

/** Edita o escritório (org) — só quem tem `escritorio.editar` (proprietário); a RLS restritiva de 0038 confere de novo. */
async function salvarEscritorioImpl(fd: FormData) {
  const perfil = await exigir('escritorio.editar');

  const nome = String(fd.get('nome') ?? '').trim();
  if (!nome) throw new ErroDeUsuario('Informe o nome do escritório.');

  const dados = {
    nome,
    municipio: String(fd.get('municipio') ?? '').trim() || null,
    uf: String(fd.get('uf') ?? '').trim().toUpperCase().slice(0, 2) || null,
  };

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('orgs').update(dados).eq('id', perfil.org_id);
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    acao: 'escritorio.editado', entidade: 'orgs', entidade_id: perfil.org_id, org_id: perfil.org_id,
  });
  revalidatePath('/app/config', 'layout');
}

export const salvarPerfilConsultor = comAviso(salvarPerfilConsultorImpl);
export const salvarEscritorio = comAviso(salvarEscritorioImpl);
