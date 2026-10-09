/**
 * Perfis de acesso da equipe e o que cada um pode fazer.
 *
 * É o ESPELHO de `agro.pode()` (supabase/migrations/0037): o banco é quem impõe a regra (RLS), esta
 * cópia serve para a tela esconder o que a pessoa não pode usar e explicar o porquê. O db-test confere,
 * para as 32 combinações de perfis × todas as permissões, que os dois concordam.
 *
 * Modelo (inspirado nos perfis combináveis do Aegro e nos padrões de papéis de SaaS): poucos perfis, com
 * descrição em linguagem de campo; uma pessoa pode somar mais de um; o menor privilégio é o padrão.
 */

export type PerfilId = 'proprietario' | 'agronomico' | 'campo' | 'financeiro' | 'leitura';

export type Permissao =
  | 'carteira.editar'
  | 'recomendacao.emitir'
  | 'tabelas.editar'
  | 'dados.exportar'
  | 'relatorios.ver'
  | 'financeiro'
  | 'equipe.gerenciar'
  | 'plano.gerenciar'
  | 'escritorio.editar'
  | 'dados.excluir'
  | 'academy.gerenciar'
  | 'academy.indicar';

export interface DefinicaoPerfil {
  id: PerfilId;
  nome: string;
  /** uma frase: para quem é */
  para: string;
  /** o que faz, em linguagem de campo */
  pode: string[];
  /** o que NÃO faz (a parte que mais evita erro na hora de escolher) */
  naoPode: string[];
}

export const PERFIS: Record<PerfilId, DefinicaoPerfil> = {
  proprietario: {
    id: 'proprietario',
    nome: 'Proprietário / Gerente',
    para: 'Quem manda no escritório.',
    pode: ['Tudo que os outros perfis fazem', 'Convidar e remover a equipe e definir perfis', 'Ver o financeiro', 'Mudar plano, cobrança e dados do escritório', 'Excluir dados (pedido LGPD)'],
    naoPode: [],
  },
  agronomico: {
    id: 'agronomico',
    nome: 'Agronômico',
    para: 'Engenheiro agrônomo ou técnico responsável.',
    pode: ['Cadastrar e editar produtores, talhões, análises e laudos', 'Emitir recomendações', 'Ajustar as tabelas técnicas', 'Exportar dados e ver relatórios', 'Publicar conteúdos na Academy e indicá-los aos produtores'],
    naoPode: ['Ver o financeiro', 'Gerenciar equipe, plano ou dados do escritório'],
  },
  campo: {
    id: 'campo',
    nome: 'Campo',
    para: 'Técnico de campo ou assistente que visita as propriedades.',
    pode: ['Lançar visitas, fotos, análises e laudos', 'Cadastrar produtores e talhões', 'Usar a agenda', 'Indicar conteúdos da Academy aos produtores'],
    naoPode: ['Emitir recomendação', 'Alterar as tabelas técnicas', 'Publicar conteúdos na Academy', 'Ver o financeiro', 'Excluir dados'],
  },
  financeiro: {
    id: 'financeiro',
    nome: 'Financeiro',
    para: 'Quem cuida do dinheiro do escritório.',
    pode: ['Financeiro do escritório (lançamentos, contas, comprovantes)', 'Ver a carteira e os relatórios'],
    naoPode: ['Alterar dados técnicos', 'Emitir recomendação', 'Gerenciar equipe'],
  },
  leitura: {
    id: 'leitura',
    nome: 'Consulta',
    para: 'Quem só precisa acompanhar (estagiário, sócio, contador).',
    pode: ['Ver a carteira, as análises e os relatórios'],
    naoPode: ['Alterar qualquer coisa', 'Ver o financeiro'],
  },
};

export const ORDEM_PERFIS: PerfilId[] = ['proprietario', 'agronomico', 'campo', 'financeiro', 'leitura'];

/** Quais perfis concedem cada permissão. O proprietário tem todas (tratado em `pode`). */
const CONCEDIDA_POR: Record<Permissao, readonly PerfilId[]> = {
  'carteira.editar': ['agronomico', 'campo'],
  'recomendacao.emitir': ['agronomico'],
  'tabelas.editar': ['agronomico'],
  'dados.exportar': ['agronomico'],
  'relatorios.ver': ['agronomico', 'financeiro', 'leitura'],
  financeiro: ['financeiro'],
  'equipe.gerenciar': [],
  'plano.gerenciar': [],
  'escritorio.editar': [],
  'dados.excluir': [],
  'academy.gerenciar': ['agronomico'],
  'academy.indicar': ['agronomico', 'campo'],
};

export const TODAS_PERMISSOES = Object.keys(CONCEDIDA_POR) as Permissao[];

/** Linhas da matriz "o que cada perfil pode", agrupadas como a pessoa pensa. */
export const MATRIZ: Array<{ grupo: string; itens: Array<{ permissao: Permissao; rotulo: string }> }> = [
  {
    grupo: 'Trabalho técnico',
    itens: [
      { permissao: 'carteira.editar', rotulo: 'Cadastrar e editar produtores, talhões, análises, visitas e laudos' },
      { permissao: 'recomendacao.emitir', rotulo: 'Emitir recomendações' },
      { permissao: 'tabelas.editar', rotulo: 'Ajustar as tabelas técnicas' },
      { permissao: 'relatorios.ver', rotulo: 'Ver relatórios e indicadores' },
      { permissao: 'dados.exportar', rotulo: 'Exportar dados' },
    ],
  },
  {
    grupo: 'Academy (universidade do produtor)',
    itens: [
      { permissao: 'academy.gerenciar', rotulo: 'Criar, publicar e arquivar conteúdos da Academy' },
      { permissao: 'academy.indicar', rotulo: 'Indicar conteúdo a um produtor' },
    ],
  },
  { grupo: 'Dinheiro', itens: [{ permissao: 'financeiro', rotulo: 'Financeiro do escritório' }] },
  {
    grupo: 'Administração',
    itens: [
      { permissao: 'equipe.gerenciar', rotulo: 'Convidar, remover e definir perfis da equipe' },
      { permissao: 'escritorio.editar', rotulo: 'Alterar dados do escritório' },
      { permissao: 'plano.gerenciar', rotulo: 'Plano e cobrança' },
      { permissao: 'dados.excluir', rotulo: 'Excluir dados de um produtor (LGPD)' },
    ],
  },
];

const IDS = new Set<string>(ORDEM_PERFIS);

/** Filtra para os perfis conhecidos, sem repetição e na ordem canônica. */
export function perfisValidos(entrada: unknown): PerfilId[] {
  const lista = Array.isArray(entrada) ? entrada : [];
  return ORDEM_PERFIS.filter((id) => lista.includes(id) && IDS.has(id));
}

export function pode(perfis: readonly string[] | null | undefined, permissao: Permissao): boolean {
  const meus = perfisValidos(perfis ?? []);
  if (meus.includes('proprietario')) return true;
  return CONCEDIDA_POR[permissao].some((p) => meus.includes(p));
}

/** Resumo para exibir: "Agronômico + Campo". */
export function rotuloDosPerfis(perfis: readonly string[] | null | undefined): string {
  const meus = perfisValidos(perfis ?? []);
  return meus.length ? meus.map((p) => PERFIS[p].nome).join(' + ') : 'Sem perfil';
}

/** Para o convite e a edição: nunca devolve vazio (menor privilégio: Consulta). */
export function perfisOuPadrao(entrada: unknown): PerfilId[] {
  const v = perfisValidos(entrada);
  return v.length ? v : ['leitura'];
}
