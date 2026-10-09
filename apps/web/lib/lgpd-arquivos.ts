/**
 * Eliminação dos ARQUIVOS de um produtor (LGPD). Apagar o produtor no banco apaga as linhas em cascata, mas os PDFs e as
 * fotos ficam no Storage — "exclusão completa" que deixa o laudo e a foto da propriedade para trás não é exclusão.
 *
 * Onde os arquivos moram (ver 0003/0004/0020): laudos/{org}/{produtor}/…, recomendacoes/{org}/{produtor}/…,
 * financeiro/{produtor}/… (por pasta) e visitas/{org}/{visita}/… (por visita: os caminhos vêm do banco, lidos ANTES
 * de apagar). Roda com a chave de serviço: o consultor não tem política de delete no Storage.
 */

/** O pedaço do cliente do Supabase de que precisamos (facilita testar com um falso). */
export interface ArmazenamentoAdmin {
  storage: {
    from(bucket: string): {
      list(pasta: string, opcoes: { limit: number; offset: number }): Promise<{ data: Array<{ name: string; id?: string | null }> | null; error: { message: string } | null }>;
      remove(caminhos: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
}

export interface ResultadoRemocao { removidos: number; falhas: number; detalhes: string[] }

const PAGINA = 100;
const LOTE = 50;

/** Todos os arquivos diretamente dentro de uma pasta (pagina até acabar). Subpastas não têm `id` e são ignoradas. */
export async function listarPasta(admin: ArmazenamentoAdmin, bucket: string, pasta: string): Promise<{ caminhos: string[]; erro?: string }> {
  const caminhos: string[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await admin.storage.from(bucket).list(pasta, { limit: PAGINA, offset });
    if (error) return { caminhos, erro: error.message };
    const arquivos = (data ?? []).filter((o) => o.id != null);
    caminhos.push(...arquivos.map((o) => `${pasta}/${o.name}`));
    if ((data ?? []).length < PAGINA) return { caminhos };
  }
}

export async function removerArquivosDoProdutor(
  admin: ArmazenamentoAdmin,
  alvo: { orgId: string | null; produtorId: string; fotosDeVisitas: readonly string[]; arquivosDePedidos?: readonly string[] },
): Promise<ResultadoRemocao> {
  const r: ResultadoRemocao = { removidos: 0, falhas: 0, detalhes: [] };
  const porBucket = new Map<string, string[]>();
  const juntar = (bucket: string, caminhos: readonly string[]) => porBucket.set(bucket, [...(porBucket.get(bucket) ?? []), ...caminhos]);

  const pastas: Array<[string, string]> = [
    ['financeiro', alvo.produtorId],
    ...(alvo.orgId ? ([['laudos', `${alvo.orgId}/${alvo.produtorId}`], ['recomendacoes', `${alvo.orgId}/${alvo.produtorId}`]] as Array<[string, string]>) : []),
  ];
  for (const [bucket, pasta] of pastas) {
    const { caminhos, erro } = await listarPasta(admin, bucket, pasta);
    if (erro) { r.falhas++; r.detalhes.push(`${bucket}: ${erro}`); }
    juntar(bucket, caminhos);
  }
  juntar('visitas', alvo.fotosDeVisitas);
  // fotos e PDFs dos pedidos do Connect: atendimentos/{org}/{pedido}/… — também só existem no banco até o delete
  if ((alvo.arquivosDePedidos ?? []).length > 0) juntar('atendimentos', alvo.arquivosDePedidos ?? []);

  for (const [bucket, caminhos] of porBucket) {
    for (let i = 0; i < caminhos.length; i += LOTE) {
      const lote = caminhos.slice(i, i + LOTE);
      const { error } = await admin.storage.from(bucket).remove(lote);
      if (error) { r.falhas += lote.length; r.detalhes.push(`${bucket}: ${error.message}`); } else r.removidos += lote.length;
    }
  }
  return r;
}
