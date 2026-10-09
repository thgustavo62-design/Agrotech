/**
 * Regras puras da Academy (a universidade do produtor): tipos, rótulos, validação do formulário e filtros.
 * O banco (0046) impõe o que é segurança (quem lê, quem escreve, https, conteúdo publicável); aqui ficam as mensagens em
 * linguagem de gente e a conveniência da tela. Os dois concordam e o db-test confere o lado do banco.
 */

export type TipoConteudo = 'video' | 'artigo' | 'material';
export type StatusConteudo = 'rascunho' | 'publicado' | 'arquivado';
export type Visibilidade = 'todos' | 'selecionados';
export type Nivel = 'basico' | 'intermediario' | 'avancado';

export const TIPOS: TipoConteudo[] = ['video', 'artigo', 'material'];
export const ROTULO_TIPO: Record<TipoConteudo, string> = { video: 'Vídeo', artigo: 'Artigo', material: 'Material' };
export const AJUDA_TIPO: Record<TipoConteudo, string> = {
  video: 'Um vídeo que já está na internet (YouTube, Vimeo…): cole o link.',
  artigo: 'Um texto escrito pelo seu escritório.',
  material: 'Uma cartilha, checklist ou imagem em PDF/JPG/PNG, ou um link para o material.',
};

export const TEMAS = ['solo', 'adubacao', 'calagem', 'pragas', 'doencas', 'irrigacao', 'colheita', 'gestao', 'seguranca', 'outro'] as const;
export type Tema = (typeof TEMAS)[number];
export const ROTULO_TEMA: Record<Tema, string> = {
  solo: 'Solo e análise', adubacao: 'Adubação', calagem: 'Calagem e gesso', pragas: 'Pragas', doencas: 'Doenças',
  irrigacao: 'Irrigação', colheita: 'Colheita e pós-colheita', gestao: 'Gestão da propriedade', seguranca: 'Segurança no trabalho', outro: 'Outro',
};

export const NIVEIS: Nivel[] = ['basico', 'intermediario', 'avancado'];
export const ROTULO_NIVEL: Record<Nivel, string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };

export const ROTULO_STATUS: Record<StatusConteudo, { txt: string; tom: 'ok' | 'alerta' | 'cinza' }> = {
  rascunho: { txt: 'rascunho', tom: 'alerta' },
  publicado: { txt: 'publicado', tom: 'ok' },
  arquivado: { txt: 'arquivado', tom: 'cinza' },
};

/** Material em arquivo: PDF ou imagem, até 10 MB (o envio de formulário do site aceita até 12 MB). */
export const MAX_ARQUIVO_ACADEMY = 10 * 1024 * 1024;

/** Linha de `agro.academy_conteudos` como as telas a usam. */
export interface Conteudo {
  id: string;
  tipo: TipoConteudo;
  titulo: string;
  descricao: string | null;
  cultura: string | null;
  tema: Tema | null;
  nivel: Nivel;
  duracao_min: number | null;
  url: string | null;
  corpo: string | null;
  arquivo_path: string | null;
  fonte: string | null;
  status: StatusConteudo;
  visibilidade: Visibilidade;
  revisado_em: string | null;
  publicado_em: string | null;
  criado_em: string;
  atualizado_em?: string;
}

export interface EntradaConteudo {
  tipo: string;
  titulo: string;
  descricao: string;
  cultura: string;
  tema: string;
  nivel: string;
  duracao_min: string;
  url: string;
  corpo: string;
  fonte: string;
  visibilidade: string;
}

export interface DadosConteudo {
  tipo: TipoConteudo;
  titulo: string;
  descricao: string | null;
  cultura: string | null;
  tema: Tema | null;
  nivel: Nivel;
  duracao_min: number | null;
  url: string | null;
  corpo: string | null;
  fonte: string | null;
  visibilidade: Visibilidade;
}

export type ResultadoValidacao = { ok: true; dados: DadosConteudo } | { ok: false; erro: string };

const vazioParaNulo = (s: string) => {
  const t = s.trim();
  return t === '' ? null : t;
};

/** Só https, com endereço de verdade (nunca http:, javascript:, data:). Devolve a URL normalizada ou null. */
export function linkSeguro(bruto: string): string | null {
  const t = bruto.trim();
  if (t === '' || t.length > 2000 || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Confere o formulário de um conteúdo. `publicar` exige que haja o que mostrar (o banco também exige: `conteudo_publicavel`);
 * `temArquivo` diz se já existe (ou está sendo enviado) um arquivo para o tipo "material".
 */
export function validarConteudo(e: EntradaConteudo, publicar: boolean, temArquivo: boolean): ResultadoValidacao {
  if (!TIPOS.includes(e.tipo as TipoConteudo)) return { ok: false, erro: 'Escolha o tipo do conteúdo.' };
  const tipo = e.tipo as TipoConteudo;

  const titulo = e.titulo.trim();
  if (titulo.length < 3) return { ok: false, erro: 'Dê um título ao conteúdo (pelo menos 3 letras).' };
  if (titulo.length > 160) return { ok: false, erro: 'O título passa de 160 letras. Encurte.' };

  const descricao = vazioParaNulo(e.descricao);
  if (descricao && descricao.length > 2000) return { ok: false, erro: 'A descrição passa de 2.000 letras.' };
  const corpo = vazioParaNulo(e.corpo);
  if (corpo && corpo.length > 20000) return { ok: false, erro: 'O texto passa de 20.000 letras. Divida em dois artigos.' };
  const cultura = vazioParaNulo(e.cultura);
  if (cultura && cultura.length > 60) return { ok: false, erro: 'O nome da cultura passa de 60 letras.' };
  const fonte = vazioParaNulo(e.fonte);
  if (fonte && fonte.length > 300) return { ok: false, erro: 'A fonte passa de 300 letras.' };

  const tema = vazioParaNulo(e.tema);
  if (tema && !(TEMAS as readonly string[]).includes(tema)) return { ok: false, erro: 'Tema inválido.' };
  if (!NIVEIS.includes(e.nivel as Nivel)) return { ok: false, erro: 'Escolha o nível.' };
  if (e.visibilidade !== 'todos' && e.visibilidade !== 'selecionados') return { ok: false, erro: 'Escolha quem pode ver.' };

  let duracao: number | null = null;
  if (e.duracao_min.trim() !== '') {
    duracao = Number(e.duracao_min.trim().replace(',', '.'));
    if (!Number.isInteger(duracao) || duracao < 1 || duracao > 600) return { ok: false, erro: 'A duração é em minutos inteiros, de 1 a 600.' };
  }

  let url: string | null = null;
  if (e.url.trim() !== '') {
    url = linkSeguro(e.url);
    if (!url) return { ok: false, erro: 'O link precisa começar com https:// e ser um endereço completo (sem espaços).' };
  }

  if (publicar) {
    if (tipo === 'video' && !url) return { ok: false, erro: 'Para publicar um vídeo, cole o link dele.' };
    if (tipo === 'artigo' && !corpo) return { ok: false, erro: 'Para publicar um artigo, escreva o texto.' };
    if (tipo === 'material' && !url && !temArquivo) return { ok: false, erro: 'Para publicar um material, envie o arquivo ou cole o link.' };
  }

  return {
    ok: true,
    dados: {
      tipo, titulo, descricao, cultura, tema: tema as Tema | null, nivel: e.nivel as Nivel, duracao_min: duracao,
      url, corpo, fonte, visibilidade: e.visibilidade as Visibilidade,
    },
  };
}

/** Minúsculas, sem acento, espaços colapsados — para a busca achar "adubação" digitando "adubacao". */
export function normalizarBusca(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface Filtro {
  busca?: string;
  tipo?: string;
  tema?: string;
  cultura?: string;
  status?: string;
}

/** Filtra a lista de conteúdos (busca em título, descrição, cultura e fonte). Filtro vazio = tudo. */
export function filtrarConteudos<T extends Pick<Conteudo, 'titulo' | 'descricao' | 'cultura' | 'fonte' | 'tipo' | 'tema' | 'status'>>(
  lista: readonly T[],
  f: Filtro,
): T[] {
  const termo = normalizarBusca(f.busca ?? '');
  const cultura = normalizarBusca(f.cultura ?? '');
  return lista.filter((c) => {
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.tema && c.tema !== f.tema) return false;
    if (f.status && c.status !== f.status) return false;
    if (cultura && normalizarBusca(c.cultura ?? '') !== cultura) return false;
    if (termo) {
      const palheiro = normalizarBusca([c.titulo, c.descricao, c.cultura, c.fonte].filter(Boolean).join(' '));
      if (!termo.split(' ').every((p) => palheiro.includes(p))) return false;
    }
    return true;
  });
}

/** Nome de arquivo seguro para o Storage: sem acento, sem barra, sem espaço, com a extensão preservada. */
export function nomeSeguroDeArquivo(nome: string): string {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  const limpo = base.replace(/-{2,}/g, '-').replace(/-+\./g, '.').slice(-80);
  return limpo || 'arquivo';
}

/** Domínio do link para mostrar "youtube.com" ao lado do botão (o produtor sabe para onde vai). */
export function dominioDoLink(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export type SituacaoIndicacao = 'indicada' | 'aberta' | 'concluida';

export function situacaoDaIndicacao(i: { aberto_em: string | null; concluido_em: string | null }): SituacaoIndicacao {
  if (i.concluido_em) return 'concluida';
  return i.aberto_em ? 'aberta' : 'indicada';
}

export const ROTULO_SITUACAO: Record<SituacaoIndicacao, { txt: string; tom: 'ok' | 'alerta' | 'cinza' }> = {
  indicada: { txt: 'ainda não abriu', tom: 'cinza' },
  aberta: { txt: 'abriu', tom: 'alerta' },
  concluida: { txt: 'concluiu', tom: 'ok' },
};
