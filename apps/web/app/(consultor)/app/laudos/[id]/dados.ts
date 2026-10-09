import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { escolherAmostra, type AmostraExtraida, type Extracao } from '@/lib/laudo-conferencia';

/** Linha de `agro.documentos` como a conferência a usa. */
export type Documento = {
  nome_arquivo: string;
  erro: string | null;
  laboratorio: string | null;
  status: string;
  storage_path: string | null;
  payload: unknown;
};

export type TalhaoOpcao = { id: string; nome: string; produtor: string };
export type Candidato = { id: string; nome: string; score: number };

/** O que a tela mostra, conforme o estado do documento. */
export type DadosConferencia =
  | { tipo: 'confirmado'; doc: Documento; geradas: Array<{ id: string; amostra_indice: number | null }> }
  | { tipo: 'extraindo'; doc: Documento }
  | {
      tipo: 'revisao';
      id: string;
      doc: Documento;
      urlPdf: string | null;
      talhoes: TalhaoOpcao[];
      extracao: Extracao | null;
      amostras: AmostraExtraida[];
      multi: boolean;
      confirmadas: Set<number>;
      atual: AmostraExtraida | undefined;
      campos: Extracao['campos'];
      extras: AmostraExtraida['extras'];
      ident: Extracao['identificacao'];
      candidatos: Candidato[];
    };

async function urlAssinadaDoPdf(sb: SupabaseClient, caminho: string | null): Promise<string | null> {
  if (!caminho) return null;
  const { data } = await sb.storage.from('laudos').createSignedUrl(caminho, 3600);
  return data?.signedUrl ?? null;
}

export async function carregarConferencia(id: string, amostraPedida: string | undefined): Promise<DadosConferencia> {
  const sb = await criarClienteServidor();

  const { data, error } = await sb.schema('agro').from('documentos').select('*').eq('id', id).single();
  if (error || !data) notFound();
  const doc = data as unknown as Documento;

  if (doc.status === 'confirmado') {
    const { data: geradas } = await sb.schema('agro').from('analises')
      .select('id, amostra_indice').eq('documento_id', id).order('amostra_indice');
    return { tipo: 'confirmado', doc, geradas: (geradas ?? []) as Array<{ id: string; amostra_indice: number | null }> };
  }

  // OCR em segundo plano: a página se atualiza sozinha até o resultado chegar
  if (doc.status === 'extraindo') {
    // O OCR tem teto de 60 s no servidor. Passou de 3 min = a leitura foi interrompida (limite de tempo, queda): em vez
    // de ficar "lendo…" para sempre, libera a conferência para lançar os valores à mão (o mesmo caminho do OCR que falha).
    const criado = Date.parse((data as { criado_em?: string }).criado_em ?? '');
    if (!Number.isFinite(criado) || Date.now() - criado < 3 * 60_000) return { tipo: 'extraindo', doc };
    doc.erro = 'A leitura automática deste PDF foi interrompida — lance os valores manualmente na conferência.';
    doc.status = 'revisao';
    await sb.schema('agro').from('documentos').update({ status: 'revisao', erro: doc.erro }).eq('id', id).eq('status', 'extraindo');
  }

  const extracao = (doc.payload ?? null) as Extracao | null;
  const amostras = extracao?.amostras ?? [];
  const multi = amostras.length > 1;
  const ident = extracao?.identificacao ?? {};
  const perfil = await perfilAtual();

  // quatro consultas independentes: numa rodada só (antes eram quatro em fila, ~100 ms cada)
  const [{ data: talhoesRaw }, urlPdf, { data: jaFeitas }, candidatos] = await Promise.all([
    sb.schema('agro').from('talhoes')
      .select('id, nome, propriedade:propriedade_id(produtor:produtor_id(nome))')
      .order('nome'),
    urlAssinadaDoPdf(sb, doc.storage_path),
    // amostras já viradas em análise (laudo em tabela confirma uma por vez)
    multi
      ? sb.schema('agro').from('analises').select('amostra_indice').eq('documento_id', id)
      : Promise.resolve({ data: [] as Array<{ amostra_indice: number | null }> }),
    ident.produtor && perfil?.org_id
      ? sb.schema('agro').rpc('casar_produtor', { p_org: perfil.org_id, p_nome: ident.produtor })
          .then((r) => (r.data ?? []) as Candidato[])
      : Promise.resolve([] as Candidato[]),
  ]);

  const talhoes: TalhaoOpcao[] = (talhoesRaw ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    // deno-lint-ignore no-explicit-any
    produtor: (t as any).propriedade?.produtor?.nome ?? '—',
  }));

  const confirmadas = new Set((jaFeitas ?? []).map((a) => a.amostra_indice as number));
  const atual = escolherAmostra(amostras, Number(amostraPedida), confirmadas);

  return {
    tipo: 'revisao',
    id,
    doc,
    urlPdf,
    talhoes,
    extracao,
    amostras,
    multi,
    confirmadas,
    atual,
    campos: (multi ? atual?.campos : extracao?.campos) ?? {},
    extras: atual?.extras ?? {},
    ident,
    candidatos,
  };
}
