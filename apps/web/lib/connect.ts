/**
 * Regras puras do Connect (pedidos do produtor e fila de atendimento): rótulos, validação dos formulários, atraso,
 * agrupamento da fila e o link do WhatsApp. O banco (0049) decide o que é segurança; aqui ficam as mensagens em linguagem
 * de gente e a conveniência da tela.
 */

export type StatusPedido = 'novo' | 'em_triagem' | 'aguardando_produtor' | 'em_acompanhamento' | 'resolvido' | 'arquivado';
export type CategoriaPedido = 'duvida' | 'problema_lavoura' | 'pedido_visita' | 'documento' | 'outro';
export type PrioridadePedido = 'normal' | 'alta' | 'urgente';

export const STATUS: StatusPedido[] = ['novo', 'em_triagem', 'aguardando_produtor', 'em_acompanhamento', 'resolvido', 'arquivado'];
/** As colunas da fila (arquivado fica fora: é histórico). */
export const COLUNAS_DA_FILA: StatusPedido[] = ['novo', 'em_triagem', 'aguardando_produtor', 'em_acompanhamento', 'resolvido'];

export const ROTULO_STATUS: Record<StatusPedido, { equipe: string; produtor: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  novo: { equipe: 'Novo', produtor: 'Enviado', tom: 'alerta' },
  em_triagem: { equipe: 'Em triagem', produtor: 'Em análise', tom: 'alerta' },
  aguardando_produtor: { equipe: 'Aguardando o produtor', produtor: 'Precisamos de você', tom: 'ruim' },
  em_acompanhamento: { equipe: 'Em acompanhamento', produtor: 'Em atendimento', tom: 'alerta' },
  resolvido: { equipe: 'Resolvido', produtor: 'Resolvido', tom: 'ok' },
  arquivado: { equipe: 'Arquivado', produtor: 'Arquivado', tom: 'cinza' },
};

export const CATEGORIAS: CategoriaPedido[] = ['duvida', 'problema_lavoura', 'pedido_visita', 'documento', 'outro'];
export const ROTULO_CATEGORIA: Record<CategoriaPedido, string> = {
  duvida: 'Uma dúvida', problema_lavoura: 'Problema na lavoura', pedido_visita: 'Pedir uma visita', documento: 'Documento ou laudo', outro: 'Outro assunto',
};
export const AJUDA_CATEGORIA: Record<CategoriaPedido, string> = {
  duvida: 'Quer entender algo sobre a análise, a recomendação ou o manejo.',
  problema_lavoura: 'Folha amarela, praga, falha no plantio… mande foto.',
  pedido_visita: 'Quer que o técnico vá até a propriedade.',
  documento: 'Precisa de um laudo, receita ou outro documento.',
  outro: 'Qualquer outro assunto com o seu técnico.',
};

export const ROTULO_PRIORIDADE: Record<PrioridadePedido, { txt: string; tom: 'cinza' | 'alerta' | 'ruim' }> = {
  normal: { txt: 'normal', tom: 'cinza' }, alta: { txt: 'alta', tom: 'alerta' }, urgente: { txt: 'urgente', tom: 'ruim' },
};

export const MAX_FOTOS_POR_ENVIO = 5;
export const MAX_BYTES_ARQUIVO = 10 * 1024 * 1024;

export interface EntradaPedido {
  assunto: string;
  descricao: string;
  categoria: string;
  urgente: boolean;
}

export type ResultadoPedido =
  | { ok: true; dados: { assunto: string; descricao: string | null; categoria: CategoriaPedido; prioridade: 'normal' | 'urgente' } }
  | { ok: false; erro: string };

/** Confere o formulário do pedido (as regras de segurança — dono, propriedade, limite — o banco confere). */
export function validarPedido(e: EntradaPedido): ResultadoPedido {
  const assunto = e.assunto.trim();
  if (assunto.length < 3) return { ok: false, erro: 'Diga em poucas palavras o assunto do pedido (pelo menos 3 letras).' };
  if (assunto.length > 160) return { ok: false, erro: 'O assunto passa de 160 letras. Encurte e conte o resto na descrição.' };
  const descricao = e.descricao.trim();
  if (descricao.length > 4000) return { ok: false, erro: 'A descrição passa de 4.000 letras. Resuma.' };
  if (!(CATEGORIAS as string[]).includes(e.categoria)) return { ok: false, erro: 'Escolha o tipo do pedido.' };
  return { ok: true, dados: { assunto, descricao: descricao || null, categoria: e.categoria as CategoriaPedido, prioridade: e.urgente ? 'urgente' : 'normal' } };
}

/** Mensagem da conversa: 1 a 4.000 letras; vazia só vale se vier com foto. */
export function validarMensagem(corpo: string, temArquivos: boolean): { ok: true; corpo: string } | { ok: false; erro: string } {
  const t = corpo.trim();
  if (t.length > 4000) return { ok: false, erro: 'A mensagem passa de 4.000 letras. Divida em duas.' };
  if (t.length === 0 && !temArquivos) return { ok: false, erro: 'Escreva a mensagem ou anexe uma foto.' };
  // o banco exige corpo: sem texto, a foto vai com uma legenda automática
  return { ok: true, corpo: t.length > 0 ? t : '(foto)' };
}

/** yyyy-mm-dd de verdade (nada de 2026-02-31). */
export function dataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export const EM_ABERTO: ReadonlySet<StatusPedido> = new Set<StatusPedido>(['novo', 'em_triagem', 'aguardando_produtor', 'em_acompanhamento']);
export const ehAberto = (s: StatusPedido) => EM_ABERTO.has(s);

export interface PedidoDaFila {
  id: string;
  status: StatusPedido;
  prioridade: PrioridadePedido;
  responsavel_id: string | null;
  vencimento: string | null;
  ultima_interacao_em: string;
  criado_em: string;
}

/** Venceu o prazo e ainda está aberto. `hoje` vem de fora (yyyy-mm-dd no fuso do escritório) para o teste não depender do relógio. */
export function estaAtrasado(p: Pick<PedidoDaFila, 'status' | 'vencimento'>, hoje: string): boolean {
  return Boolean(p.vencimento) && ehAberto(p.status) && (p.vencimento as string) < hoje;
}

/** Dias inteiros desde a última interação (para "parado há 3 dias"). */
export function diasParado(ultima: string, agora: Date): number {
  const ms = agora.getTime() - new Date(ultima).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

const PESO_PRIORIDADE: Record<PrioridadePedido, number> = { urgente: 0, alta: 1, normal: 2 };

/** Ordem dentro de uma coluna: urgente primeiro, depois o que vence antes, depois o mais antigo. */
export function ordenarFila<T extends PedidoDaFila>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) =>
    PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
    || (a.vencimento ?? '9999-99-99').localeCompare(b.vencimento ?? '9999-99-99')
    || a.criado_em.localeCompare(b.criado_em));
}

export interface FiltroFila { quem?: 'todos' | 'meus' | 'sem_responsavel'; prioridade?: string; busca?: string; atrasados?: boolean }

export function filtrarFila<T extends PedidoDaFila & { assunto: string; produtor?: string | null }>(
  lista: readonly T[], f: FiltroFila, euId: string | null, hoje: string,
): T[] {
  const termo = (f.busca ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return lista.filter((p) => {
    if (f.quem === 'meus' && p.responsavel_id !== euId) return false;
    if (f.quem === 'sem_responsavel' && p.responsavel_id !== null) return false;
    if (f.prioridade && p.prioridade !== f.prioridade) return false;
    if (f.atrasados && !estaAtrasado(p, hoje)) return false;
    if (termo) {
      const palheiro = `${p.assunto} ${p.produtor ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (!termo.split(/\s+/).every((t) => palheiro.includes(t))) return false;
    }
    return true;
  });
}

export function agruparPorStatus<T extends PedidoDaFila>(lista: readonly T[]): Record<StatusPedido, T[]> {
  const grupos = Object.fromEntries(STATUS.map((s) => [s, [] as T[]])) as Record<StatusPedido, T[]>;
  for (const p of ordenarFila(lista)) grupos[p.status].push(p);
  return grupos;
}

export interface ResumoDaFila { abertos: number; semResponsavel: number; atrasados: number; urgentes: number; aguardandoProdutor: number }

export function resumirFila(lista: readonly PedidoDaFila[], hoje: string): ResumoDaFila {
  const abertos = lista.filter((p) => ehAberto(p.status));
  return {
    abertos: abertos.length,
    semResponsavel: abertos.filter((p) => !p.responsavel_id).length,
    atrasados: abertos.filter((p) => estaAtrasado(p, hoje)).length,
    urgentes: abertos.filter((p) => p.prioridade === 'urgente').length,
    aguardandoProdutor: abertos.filter((p) => p.status === 'aguardando_produtor').length,
  };
}

/**
 * Link do WhatsApp (wa.me) com o texto já escrito — o clique é da pessoa; nada é enviado sozinho. Aceita telefone do jeito que o
 * cadastro guarda: "(27) 99912-3455", "27999123455", "+55 27 99912-3455". Sem número plausível devolve null.
 */
export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  let d = (telefone ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null; // DDD + número (fixo 8 ou celular 9 dígitos)
  if (d.length === 11 && d[2] !== '9') return null; // celular tem o 9 depois do DDD
  return `https://wa.me/55${d}?text=${encodeURIComponent(texto.slice(0, 500))}`;
}

/** Pedido que veio de um laudo/visita: mensagem pronta para o técnico abrir a conversa no WhatsApp. */
export function textoParaWhatsApp(nomeProdutor: string | null, assunto: string): string {
  const primeiro = (nomeProdutor ?? '').trim().split(/\s+/)[0];
  return `${primeiro ? `Olá, ${primeiro}!` : 'Olá!'} Sobre o seu pedido “${assunto}” no AgroTech Connect: `;
}

/**
 * Link para o produtor pedir ajuda a partir de outra tela (laudo, recomendação, talhão), com o assunto e o talhão já
 * preenchidos. Só repassa o que é seguro: tipo conhecido, assunto curto, id no formato de UUID.
 */
export function linkPedirAjuda(o: { assunto?: string; categoria?: CategoriaPedido; talhaoId?: string; origem?: 'atlas' }): string {
  const q = new URLSearchParams();
  if (o.origem === 'atlas') q.set('origem', 'atlas');
  if (o.categoria && CATEGORIAS.includes(o.categoria)) q.set('categoria', o.categoria);
  const assunto = (o.assunto ?? '').trim().slice(0, 160);
  if (assunto) q.set('assunto', assunto);
  if (o.talhaoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.talhaoId)) q.set('talhao', o.talhaoId);
  const s = q.toString();
  return s ? `/connect/pedidos/novo?${s}` : '/connect/pedidos/novo';
}

/** Nome do arquivo no Storage: sem acento, barra ou espaço; preserva a extensão. */
export function nomeSeguroDeAnexo(nome: string): string {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return base.replace(/-{2,}/g, '-').replace(/-+\./g, '.').slice(-80) || 'arquivo';
}

export const ROTULO_EVENTO = {
  criado: 'Pedido enviado',
  status: 'Mudou de situação',
  responsavel: 'Responsável definido',
  prazo: 'Prazo definido',
  prioridade: 'Prioridade alterada',
  mensagem: 'Nova mensagem',
} as const;
export type TipoEvento = keyof typeof ROTULO_EVENTO;

const dataCurta = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null);

/**
 * Frase do histórico. O produtor vê só o que importa a ele (a situação, o prazo, a conversa); quem é o responsável e a
 * prioridade interna são da equipe. `nomes` traduz o id de uma pessoa da equipe.
 */
export function descreverEvento(
  e: { tipo: TipoEvento; de: string | null; para: string | null },
  visao: 'equipe' | 'produtor',
  nomes: ReadonlyMap<string, string> = new Map(),
): string | null {
  switch (e.tipo) {
    case 'criado': return 'Pedido enviado';
    case 'mensagem': return 'Nova mensagem';
    case 'status': {
      const novo = e.para && e.para in ROTULO_STATUS ? ROTULO_STATUS[e.para as StatusPedido][visao] : e.para;
      return novo ? `Situação: ${novo}` : null;
    }
    case 'prazo':
      if (visao === 'produtor') return e.para ? `Prazo previsto: ${dataCurta(e.para)}` : null;
      return e.para ? `Prazo definido para ${dataCurta(e.para)}` : 'Prazo removido';
    case 'responsavel':
      if (visao === 'produtor') return null;
      return e.para ? `Responsável: ${nomes.get(e.para) ?? 'outra pessoa'}` : 'Sem responsável';
    case 'prioridade':
      return visao === 'equipe' && e.para ? `Prioridade: ${e.para}` : null;
  }
}
