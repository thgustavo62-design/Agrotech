'use server';

import { revalidatePath } from 'next/cache';
import { PADRAO, validarCultura, validarQuebras, type ChaveFaixa, type Cultura, type Faixa, type FaixaFosforo } from '@agrotech/agro-core';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { registrar } from '@/lib/audit';

const num = (v: FormDataEntryValue | null) => Number(String(v ?? '').trim().replace(',', '.'));
const cinco = (fd: FormData, p: string) => [0, 1, 2, 3, 4].map((i) => num(fd.get(`${p}${i}`))) as Cultura['P'];

type TipoTabela = 'culturas' | 'faixas' | 'fosforo';

async function gravarTabela(tipo: TipoTabela, conteudo: unknown, acao: string, dados: Record<string, unknown> = {}) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new Error('Sessão sem escritório associado.');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') throw new Error('Sem permissão.');

  const sb = await criarClienteServidor();
  const { data: atual } = await sb.schema('agro').from('tabelas_referencia')
    .select('versao').eq('org_id', perfil.org_id).eq('tipo', tipo).maybeSingle();

  const { error } = await sb.schema('agro').from('tabelas_referencia').upsert(
    { org_id: perfil.org_id, tipo, conteudo, versao: (atual?.versao ?? 0) + 1 },
    { onConflict: 'org_id,tipo' },
  );
  if (error) throw new Error(error.message);

  await registrar(sb, { acao, entidade: 'tabelas_referencia', org_id: perfil.org_id, dados: { tipo, ...dados } });
  revalidatePath('/app/tabelas');
}

const gravarCulturas = (culturas: Record<string, Cultura>, acao: string, chave: string) =>
  gravarTabela('culturas', culturas, acao, { cultura: chave });

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

const quatro = (fd: FormData, p: string) => [0, 1, 2, 3].map((i) => num(fd.get(`${p}${i}`)));

/** Salva os pontos de corte de todas as faixas de interpretação (campos `f_<chave>_0..3`).
 *  Muda a classificação de análises FUTURAS; laudos emitidos guardam o próprio snapshot. */
export async function salvarFaixas(fd: FormData) {
  const sb = await criarClienteServidor();
  const atuais = (await tabelasDaOrg(sb)).faixas;
  const novas = { ...atuais };
  const erros: string[] = [];

  for (const [chave, base] of Object.entries(PADRAO.faixas) as Array<[ChaveFaixa, Faixa]>) {
    if (!base.q) continue; // P depende da argila: editado na tabela de fósforo
    const q = quatro(fd, `f_${chave}_`);
    const e = validarQuebras(base.rot, q);
    if (e.length) erros.push(...e);
    else novas[chave] = { ...atuais[chave], q: q as Faixa['q'] };
  }
  if (erros.length) throw new Error(erros.join(' '));
  await gravarTabela('faixas', novas, 'tabela.faixas_editadas');
}

export async function restaurarFaixas() {
  await gravarTabela('faixas', PADRAO.faixas, 'tabela.faixas_restauradas');
}

/** Salva os pontos de corte do fósforo por classe de argila (campos `p_<i>_0..3`). */
export async function salvarFosforo(fd: FormData) {
  const erros: string[] = [];
  const nova = PADRAO.fosforo.map((linha, i) => {
    const q = quatro(fd, `p_${i}_`);
    erros.push(...validarQuebras(`Fósforo ${linha.argila}`, q));
    return { ...linha, q: q as FaixaFosforo['q'] };
  });
  if (erros.length) throw new Error(erros.join(' '));
  await gravarTabela('fosforo', nova, 'tabela.fosforo_editado');
}

export async function restaurarFosforo() {
  await gravarTabela('fosforo', PADRAO.fosforo, 'tabela.fosforo_restaurado');
}
