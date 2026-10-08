'use server';

import { redirect } from 'next/navigation';
import { gerarRecomendacao, validarAnalise } from '@agrotech/agro-core';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { paraAnalise } from '@/lib/culturas';
import { registrar } from '@/lib/audit';
import { mensagemDeBloqueio } from '@/lib/analise-validacao';
import { identidadeDoLaudo } from '@/lib/identidade-laudo';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';

/**
 * Emite (persiste) a recomendação de uma análise em agro.recomendacoes:
 * motor_versao + snapshot das tabelas + resultado completo. É o que o produtor
 * lê depois — nada é recalculado na leitura.
 */
async function emitirRecomendacaoImpl(fd: FormData) {
  const analiseId = String(fd.get('analise_id') ?? '');
  if (!analiseId) throw new ErroDeUsuario('análise não informada');

  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();

  const [{ data, error }, tabelas, { data: eu }, { data: org }] = await Promise.all([
    sb.schema('agro').from('analises').select(
      `id, data_coleta, profundidade, laboratorio, prnt, incorporacao, prod_esperada,
       argila, ph, mo, p, k, na, ca, mg, al, h_al, s, b, zn, cu, mn, fe,
       talhao:talhao_id (
         nome, cultura, variedade, area_ha, prod_esperada,
         propriedade:propriedade_id ( nome, municipio, produtor:produtor_id ( nome ) )
       )`,
    ).eq('id', analiseId).single(),
    tabelasDaOrg(sb),
    perfil ? sb.schema('agro').from('profiles').select('nome, crea, fone').eq('id', perfil.id).maybeSingle() : Promise.resolve({ data: null }),
    perfil?.org_id ? sb.schema('agro').from('orgs').select('nome, municipio, uf').eq('id', perfil.org_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error || !data) throw new ErroDeUsuario('análise não encontrada');

  // quem assina: o escritório e o responsável técnico (CREA) de quem está emitindo
  const identidade = identidadeDoLaudo(eu ?? {}, org ?? {});
  if (!identidade.ok) throw new ErroDeUsuario(identidade.mensagem);

  // A regra vale no SERVIDOR (a tela só avisa antes): análise incompleta ou impossível nunca vira recomendação,
  // porque o motor trata campo em branco como zero e emitiria um laudo sobre dados que não existem.
  const valores = paraAnalise(data);
  const validacao = validarAnalise(valores);
  if (!validacao.ok) throw new ErroDeUsuario(mensagemDeBloqueio(validacao, valores as Record<string, unknown>));

  // deno-lint-ignore no-explicit-any
  const t = (data as any).talhao;
  const cultura = t?.cultura ? tabelas.culturas[t.cultura as string] : undefined;

  const rec = gerarRecomendacao({
    analise: { ...paraAnalise(data), prnt: data.prnt, incorp: data.incorporacao },
    ...(cultura ? { cultura } : {}),
    ...(data.prod_esperada != null || t?.prod_esperada != null
      ? { prodEsperadaTalhao: Number(data.prod_esperada ?? t?.prod_esperada) }
      : {}),
    areaHa: Number(t?.area_ha ?? 0),
    tabelas,
  });

  const resultado = {
    ...rec,
    // snapshot do contexto para o laudo do produtor (que não lê profiles do consultor)
    contexto: {
      produtor: t?.propriedade?.produtor?.nome ?? '',
      propriedade: t?.propriedade?.nome ?? '',
      municipio: t?.propriedade?.municipio ?? '',
      talhao: t?.nome ?? '',
      variedade: t?.variedade ?? '',
      culturaNome: cultura?.nome ?? '',
      culturaUn: cultura?.un ?? '',
      culturaParc: cultura?.parc ?? [],
      culturaObs: cultura?.obs ?? '',
      dataColeta: data.data_coleta,
      profundidade: data.profundidade ?? '0-20',
      laboratorio: data.laboratorio ?? '',
      consultor: identidade.consultor,
    },
    analise_valores: { ...paraAnalise(data), prnt: data.prnt, incorp: data.incorporacao },
  };

  const { data: nova, error: eIns } = await sb.schema('agro').from('recomendacoes').insert({
    analise_id: analiseId,
    motor_versao: rec.motor_versao,
    tabelas_snapshot: rec.tabelas_snapshot,
    resultado,
    emitida_por: perfil?.id ?? null,
  }).select('id').single();
  if (eIns) lancarDoBanco(eIns);

  await registrar(sb, {
    acao: 'recomendacao.emitida',
    entidade: 'recomendacoes',
    entidade_id: nova?.id ?? null,
    org_id: perfil?.org_id ?? null,
    dados: { analise_id: analiseId, motor_versao: rec.motor_versao },
  });

  redirect(`/app/analises/${analiseId}/laudo`);
}

export const emitirRecomendacao = comAviso(emitirRecomendacaoImpl);
