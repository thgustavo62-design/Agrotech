import type { FichaAtlas, TipoFicha } from './atlas-base';
import { linkSeguro } from './academy';

/**
 * Fichas do Atlas escritas pelo escritório (migração 0050): tipos, validação do formulário e conversão para o mesmo formato das
 * fichas-base, para a busca, as trilhas e a página da ficha tratarem as duas igual. O banco impõe o que é segurança; aqui ficam
 * as mensagens em linguagem de gente.
 */

export type StatusFicha = 'rascunho' | 'publicado' | 'arquivado';
export type TipoDeFicha = TipoFicha | 'outro';

export const TIPOS_DE_FICHA: TipoDeFicha[] = ['doenca', 'praga', 'outro'];
export const ROTULO_TIPO_FICHA: Record<TipoDeFicha, string> = { doenca: 'Doença', praga: 'Praga', outro: 'Outro problema' };

export const PARTES = ['folha', 'fruto', 'flor', 'ramo', 'ponteiro', 'raiz', 'colo', 'caule', 'muda'] as const;
export type ParteDaPlanta = (typeof PARTES)[number];
export const ROTULO_PARTE: Record<ParteDaPlanta, string> = {
  folha: 'Folha', fruto: 'Fruto', flor: 'Flor', ramo: 'Ramo', ponteiro: 'Ponteiro', raiz: 'Raiz', colo: 'Colo', caule: 'Caule', muda: 'Muda (viveiro)',
};

export const IMPORTANCIAS = ['extrema', 'alta', 'media', 'baixa', 'nula'] as const;
export type Importancia = (typeof IMPORTANCIAS)[number];
export const ROTULO_IMPORTANCIA: Record<Importancia, string> = { extrema: 'Extrema', alta: 'Alta', media: 'Média', baixa: 'Baixa', nula: 'Nula' };

export const MAX_FOTOS_DA_FICHA = 8;
export const MAX_ITENS = 12;
const LIMITE = { sobre: 1500, favorecem: 600, manejo: 900, monitoramento: 900 } as const;

export const ROTULO_STATUS_FICHA: Record<StatusFicha, { txt: string; tom: 'ok' | 'alerta' | 'cinza' }> = {
  rascunho: { txt: 'rascunho', tom: 'alerta' },
  publicado: { txt: 'publicada', tom: 'ok' },
  arquivado: { txt: 'arquivada', tom: 'cinza' },
};

/** Linha de `agro.atlas_fichas` como as telas a usam. */
export interface FichaDoBanco {
  id: string;
  tipo: TipoDeFicha;
  nome: string;
  cientifico: string | null;
  outros_nomes: string | null;
  cultura: string | null;
  partes: ParteDaPlanta[];
  importancia_campo: Importancia | null;
  importancia_viveiro: Importancia | null;
  sobre: string[];
  favorecem: string[];
  manejo: string[];
  monitoramento: string[];
  confunde: string | null;
  fonte: string | null;
  url: string | null;
  status: StatusFicha;
  publicado_em: string | null;
  atualizado_em?: string;
}

/** Um item por linha: tira espaços, descarta linhas vazias. */
export function linhasDoTexto(texto: string): string[] {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}
/** O inverso, para preencher a caixa de texto ao editar. */
export const textoDasLinhas = (itens: readonly string[] | null | undefined): string => (itens ?? []).join('\n');

export interface EntradaFicha {
  tipo: string;
  nome: string;
  cientifico: string;
  outros_nomes: string;
  cultura: string;
  partes: string[];
  importancia_campo: string;
  importancia_viveiro: string;
  sobre: string;
  favorecem: string;
  manejo: string;
  monitoramento: string;
  confunde: string;
  fonte: string;
  url: string;
}

export type DadosFicha = Omit<FichaDoBanco, 'id' | 'status' | 'publicado_em' | 'atualizado_em'>;
export type ResultadoFicha = { ok: true; dados: DadosFicha } | { ok: false; erro: string };

const vazioParaNulo = (s: string) => {
  const t = s.trim();
  return t === '' ? null : t;
};

/**
 * Confere o formulário. `publicar` exige o que a ficha precisa para ser útil (texto sobre a ficha e ao menos uma parte da
 * planta); `temFoto` diz se já há (ou está sendo enviada) ao menos uma foto — o banco também exige.
 */
export function validarFicha(e: EntradaFicha, publicar: boolean, temFoto: boolean): ResultadoFicha {
  if (!(TIPOS_DE_FICHA as string[]).includes(e.tipo)) return { ok: false, erro: 'Escolha se é uma doença, uma praga ou outro problema.' };
  const nome = e.nome.trim();
  if (nome.length < 3) return { ok: false, erro: 'Dê um nome à ficha (pelo menos 3 letras).' };
  if (nome.length > 120) return { ok: false, erro: 'O nome passa de 120 letras. Encurte.' };

  const cientifico = vazioParaNulo(e.cientifico);
  if (cientifico && cientifico.length > 160) return { ok: false, erro: 'O nome científico passa de 160 letras.' };
  const outros = vazioParaNulo(e.outros_nomes);
  if (outros && outros.length > 200) return { ok: false, erro: 'Os outros nomes passam de 200 letras.' };
  const cultura = vazioParaNulo(e.cultura);
  if (cultura && cultura.length > 60) return { ok: false, erro: 'O nome da cultura passa de 60 letras.' };
  const confunde = vazioParaNulo(e.confunde);
  if (confunde && confunde.length > 500) return { ok: false, erro: 'O alerta de "pode ser confundida com" passa de 500 letras.' };
  const fonte = vazioParaNulo(e.fonte);
  if (fonte && fonte.length > 300) return { ok: false, erro: 'A fonte passa de 300 letras.' };

  let url: string | null = null;
  if (e.url.trim() !== '') {
    url = linkSeguro(e.url);
    if (!url) return { ok: false, erro: 'O link da fonte precisa começar com https:// e ser um endereço completo (sem espaços).' };
  }

  const partes = [...new Set(e.partes)].filter((p): p is ParteDaPlanta => (PARTES as readonly string[]).includes(p));
  if (partes.length !== new Set(e.partes).size) return { ok: false, erro: 'Parte da planta inválida.' };

  const imp = (v: string, rotulo: string): { ok: true; v: Importancia | null } | { ok: false; erro: string } => {
    if (v === '') return { ok: true, v: null };
    return (IMPORTANCIAS as readonly string[]).includes(v) ? { ok: true, v: v as Importancia } : { ok: false, erro: `Importância ${rotulo} inválida.` };
  };
  const ic = imp(e.importancia_campo, 'no campo');
  if (!ic.ok) return ic;
  const iv = imp(e.importancia_viveiro, 'no viveiro');
  if (!iv.ok) return iv;

  const listas = {
    sobre: linhasDoTexto(e.sobre), favorecem: linhasDoTexto(e.favorecem), manejo: linhasDoTexto(e.manejo), monitoramento: linhasDoTexto(e.monitoramento),
  };
  const rotulos = { sobre: 'O que é', favorecem: 'O que favorece', manejo: 'Como manejar', monitoramento: 'Como monitorar' } as const;
  for (const k of Object.keys(listas) as Array<keyof typeof listas>) {
    if (listas[k].length > MAX_ITENS) return { ok: false, erro: `"${rotulos[k]}" tem mais de ${MAX_ITENS} linhas. Junte algumas.` };
    const grande = listas[k].find((l) => l.length > LIMITE[k]);
    if (grande) return { ok: false, erro: `Uma linha de "${rotulos[k]}" passa de ${LIMITE[k]} letras. Divida em duas linhas.` };
  }

  if (publicar) {
    if (listas.sobre.length === 0) return { ok: false, erro: 'Para publicar, escreva o que é (a primeira seção da ficha).' };
    if (partes.length === 0) return { ok: false, erro: 'Para publicar, marque onde aparece na planta (folha, fruto, raiz…).' };
    if (!temFoto) return { ok: false, erro: 'Para publicar, adicione pelo menos uma foto.' };
  }

  return {
    ok: true,
    dados: {
      tipo: e.tipo as TipoDeFicha, nome, cientifico, outros_nomes: outros, cultura, partes,
      importancia_campo: ic.v, importancia_viveiro: iv.v,
      sobre: listas.sobre, favorecem: listas.favorecem, manejo: listas.manejo, monitoramento: listas.monitoramento,
      confunde, fonte, url,
    },
  };
}

/** Converte a ficha do banco para o formato das fichas-base (a busca, as trilhas e os cartões tratam as duas igual). */
export function paraFichaAtlas(f: FichaDoBanco, fotoUrls: string[], totalDeFotos: number = fotoUrls.length): FichaAtlas {
  const rot = (i: Importancia | null) => (i ? ROTULO_IMPORTANCIA[i] : '—');
  return {
    slug: f.id,
    // "outro problema" fica junto das pragas na tela (a base só conhece doença e praga)
    tipo: f.tipo === 'doenca' ? 'doenca' : 'praga',
    nome: f.nome,
    cientifico: f.cientifico ?? '',
    outrosNomes: f.outros_nomes ? f.outros_nomes.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean) : undefined,
    partes: f.partes,
    importancia: { campo: rot(f.importancia_campo), viveiro: rot(f.importancia_viveiro) },
    sobre: f.sobre,
    favorecem: f.favorecem,
    manejo: f.manejo,
    monitoramento: f.monitoramento.length > 0 ? f.monitoramento : undefined,
    confunde: f.confunde ?? undefined,
    fotos: totalDeFotos,
    creditos: 'fotos do escritório',
    origem: 'escritorio',
    fotoUrls,
    cultura: f.cultura,
    fonteTexto: f.fonte,
    fonteUrl: f.url,
  };
}
