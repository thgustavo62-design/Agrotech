import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoriaPedido, PrioridadePedido, StatusPedido, TipoEvento } from '@/lib/connect';

/** Leituras do Connect (a RLS decide o que cada pessoa enxerga: o produtor nunca recebe nota interna). */

export interface PedidoResumo {
  id: string;
  assunto: string;
  categoria: CategoriaPedido;
  prioridade: PrioridadePedido;
  status: StatusPedido;
  origem: string;
  vencimento: string | null;
  responsavel_id: string | null;
  produtor_id: string;
  ultima_interacao_em: string;
  criado_em: string;
  avaliacao: number | null;
  /** nome do produtor (só a equipe precisa) */
  produtor: string | null;
}

const COLUNAS_RESUMO = 'id, assunto, categoria, prioridade, status, origem, vencimento, responsavel_id, produtor_id, ultima_interacao_em, criado_em, avaliacao, produtores(nome)';

type LinhaResumo = Omit<PedidoResumo, 'produtor'> & { produtores: { nome: string } | { nome: string }[] | null };

function nomeDoProdutor(p: LinhaResumo['produtores']): string | null {
  return Array.isArray(p) ? (p[0]?.nome ?? null) : (p?.nome ?? null);
}

function achatar(l: LinhaResumo): PedidoResumo {
  const { produtores, ...resto } = l;
  return { ...resto, produtor: nomeDoProdutor(produtores) };
}

/** Pedidos visíveis para quem está logado (produtor: só os dele; equipe: todos do escritório). Mais recentes primeiro. */
export async function carregarPedidos(sb: SupabaseClient, opcoes: { limite?: number } = {}): Promise<PedidoResumo[]> {
  const { data } = await sb.schema('agro').from('atendimentos').select(COLUNAS_RESUMO)
    .order('ultima_interacao_em', { ascending: false }).limit(opcoes.limite ?? 300);
  return ((data ?? []) as unknown as LinhaResumo[]).map(achatar);
}

export interface MembroDaEquipe { id: string; nome: string }

/** Equipe ativa do escritório (para escolher o responsável e mostrar quem escreveu). */
export async function carregarEquipe(sb: SupabaseClient): Promise<MembroDaEquipe[]> {
  const { data } = await sb.schema('agro').from('profiles').select('id, nome').in('role', ['consultor', 'admin']).is('desativado_em', null).order('nome');
  return ((data ?? []) as Array<{ id: string; nome: string | null }>).map((p) => ({ id: p.id, nome: p.nome ?? 'Sem nome' }));
}

export interface OpcaoTalhao { id: string; nome: string; cultura: string; propriedade_id: string }
export interface OpcaoPropriedade { id: string; nome: string; produtor_id: string }

/** Propriedades e talhões que a pessoa pode ligar a um pedido (produtor: os dele; equipe: do produtor escolhido, se informado). */
export async function carregarLocais(sb: SupabaseClient, produtorId?: string): Promise<{ propriedades: OpcaoPropriedade[]; talhoes: OpcaoTalhao[] }> {
  let qp = sb.schema('agro').from('propriedades').select('id, nome, produtor_id').order('nome');
  if (produtorId) qp = qp.eq('produtor_id', produtorId);
  const { data: props } = await qp;
  const propriedades = (props ?? []) as OpcaoPropriedade[];
  if (propriedades.length === 0) return { propriedades, talhoes: [] };
  const { data: tals } = await sb.schema('agro').from('talhoes').select('id, nome, cultura, propriedade_id')
    .in('propriedade_id', propriedades.map((p) => p.id)).order('nome');
  return { propriedades, talhoes: (tals ?? []) as OpcaoTalhao[] };
}

export interface Mensagem {
  id: string;
  autor_id: string | null;
  autor_tipo: 'produtor' | 'equipe';
  corpo: string;
  interna: boolean;
  criado_em: string;
  arquivos: ArquivoDoPedido[];
}
export interface ArquivoDoPedido { id: string; mensagem_id: string | null; nome: string; mime: string; bytes: number | null; url: string | null }
export interface EventoDoPedido { id: string; tipo: TipoEvento; de: string | null; para: string | null; autor_id: string | null; criado_em: string }

export interface PedidoCompleto extends PedidoResumo {
  descricao: string | null;
  propriedade_id: string | null;
  talhao_id: string | null;
  propriedade: string | null;
  talhao: string | null;
  cultura: string | null;
  produtor_fone: string | null;
  avaliacao_comentario: string | null;
  avaliado_em: string | null;
  resolvido_em: string | null;
  mensagens: Mensagem[];
  /** fotos do pedido em si (sem mensagem) */
  arquivosDoPedido: ArquivoDoPedido[];
  eventos: EventoDoPedido[];
}

const UMA_HORA = 3600;

/** O pedido com conversa, arquivos (links assinados de 1 h) e histórico. null se não existir ou não for visível. */
export async function carregarPedido(sb: SupabaseClient, id: string): Promise<PedidoCompleto | null> {
  const s = sb.schema('agro');
  const { data: p } = await s.from('atendimentos')
    .select(`${COLUNAS_RESUMO}, descricao, propriedade_id, talhao_id, avaliacao_comentario, avaliado_em, resolvido_em`)
    .eq('id', id).maybeSingle();
  if (!p) return null;
  const base = p as unknown as LinhaResumo & {
    descricao: string | null; propriedade_id: string | null; talhao_id: string | null;
    avaliacao_comentario: string | null; avaliado_em: string | null; resolvido_em: string | null;
  };

  const [msgs, arqs, evs, prop, tal, prod] = await Promise.all([
    s.from('atendimento_mensagens').select('id, autor_id, autor_tipo, corpo, interna, criado_em').eq('atendimento_id', id).order('criado_em'),
    s.from('atendimento_arquivos').select('id, mensagem_id, nome, mime, bytes, storage_path').eq('atendimento_id', id).order('criado_em'),
    s.from('atendimento_eventos').select('id, tipo, de, para, autor_id, criado_em').eq('atendimento_id', id).order('criado_em'),
    base.propriedade_id ? s.from('propriedades').select('nome').eq('id', base.propriedade_id).maybeSingle() : Promise.resolve({ data: null }),
    base.talhao_id ? s.from('talhoes').select('nome, cultura').eq('id', base.talhao_id).maybeSingle() : Promise.resolve({ data: null }),
    s.from('produtores').select('fone').eq('id', base.produtor_id).maybeSingle(),
  ]);

  const linhasArq = (arqs.data ?? []) as Array<Omit<ArquivoDoPedido, 'url'> & { storage_path: string }>;
  const urls = new Map<string, string>();
  if (linhasArq.length > 0) {
    const { data: assinados } = await sb.storage.from('atendimentos').createSignedUrls(linhasArq.map((a) => a.storage_path), UMA_HORA);
    for (const a of assinados ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  }
  const arquivos: ArquivoDoPedido[] = linhasArq.map((a) => ({
    id: a.id, mensagem_id: a.mensagem_id, nome: a.nome, mime: a.mime, bytes: a.bytes, url: urls.get(a.storage_path) ?? null,
  }));

  const mensagens: Mensagem[] = ((msgs.data ?? []) as Array<Omit<Mensagem, 'arquivos'>>).map((m) => ({
    ...m, arquivos: arquivos.filter((a) => a.mensagem_id === m.id),
  }));

  const resumo = achatar(base);
  return {
    ...resumo,
    descricao: base.descricao,
    propriedade_id: base.propriedade_id,
    talhao_id: base.talhao_id,
    propriedade: (prop.data as { nome: string } | null)?.nome ?? null,
    talhao: (tal.data as { nome: string; cultura: string } | null)?.nome ?? null,
    cultura: (tal.data as { nome: string; cultura: string } | null)?.cultura ?? null,
    produtor_fone: (prod.data as { fone: string | null } | null)?.fone ?? null,
    avaliacao_comentario: base.avaliacao_comentario,
    avaliado_em: base.avaliado_em,
    resolvido_em: base.resolvido_em,
    mensagens,
    arquivosDoPedido: arquivos.filter((a) => a.mensagem_id === null),
    eventos: (evs.data ?? []) as EventoDoPedido[],
  };
}
