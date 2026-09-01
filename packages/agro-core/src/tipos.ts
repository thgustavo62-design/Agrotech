/**
 * Tipos do domínio agronômico. Todos os valores numéricos de análise são
 * aceitos como `number | string | null` para casar com o que vem de formulário
 * ou de parser; o motor normaliza internamente com `n()`.
 */

export type ValorAnalise = number | string | null | undefined;

/** Uma análise de solo lançada (camada única, tipicamente 0-20 cm). */
export interface Analise {
  /** teor de argila em % — define a classe de interpretação do fósforo */
  argila?: ValorAnalise;
  pH?: ValorAnalise;
  /** matéria orgânica, dag/kg */
  MO?: ValorAnalise;
  /** fósforo Mehlich-1, mg/dm³ */
  P?: ValorAnalise;
  /** potássio, mg/dm³ */
  K?: ValorAnalise;
  /** sódio, mg/dm³ */
  Na?: ValorAnalise;
  /** cálcio, cmolc/dm³ */
  Ca?: ValorAnalise;
  /** magnésio, cmolc/dm³ */
  Mg?: ValorAnalise;
  /** alumínio trocável, cmolc/dm³ */
  Al?: ValorAnalise;
  /** acidez potencial H+Al, cmolc/dm³ */
  HAl?: ValorAnalise;
  /** enxofre, mg/dm³ */
  S?: ValorAnalise;
  B?: ValorAnalise;
  Zn?: ValorAnalise;
  Cu?: ValorAnalise;
  Mn?: ValorAnalise;
  Fe?: ValorAnalise;
  /** PRNT do calcário disponível, % (padrão 85) */
  prnt?: ValorAnalise;
  /** profundidade de incorporação, cm: 20 | 30 | 40 (padrão 20) */
  incorp?: ValorAnalise;
  /** produtividade esperada; sobrescreve a do talhão quando informada */
  prodEsperada?: ValorAnalise;
}

/** Faixa de interpretação de um parâmetro: 4 quebras => 5 classes. */
export interface Faixa {
  rot: string;
  un: string;
  /** 4 pontos de quebra crescentes, ou null quando depende de contexto (P) */
  q: [number, number, number, number] | null;
  /** true quando valor alto é problema (Al, H+Al, m%) */
  inv?: boolean;
  /** rótulos de classe próprios (ex.: pH) */
  nomes?: [string, string, string, string, string];
  /** cores de classe próprias, chaves curtas: mb b m bom mbom */
  cores?: [string, string, string, string, string];
}

export type ChaveFaixa =
  | 'pH' | 'MO' | 'P' | 'K' | 'Ca' | 'Mg' | 'Al' | 'HAl'
  | 'S' | 'B' | 'Zn' | 'Cu' | 'Mn' | 'Fe'
  | 'SB' | 't' | 'T' | 'V' | 'm';

/** Faixa de fósforo por classe de argila (Mehlich-1). */
export interface FaixaFosforo {
  argila: string;
  /** limite inferior de argila (%) que ativa esta faixa */
  min: number;
  q: [number, number, number, number];
}

/** Parâmetros e doses de referência de uma cultura. */
export interface Cultura {
  nome: string;
  /** unidade da produtividade (sc/ha, t/ha, UA/ha, m³/ha/ano...) */
  un: string;
  /** produtividade de referência para as doses da tabela */
  ref: number;
  /** saturação por bases desejada, % */
  V2: number;
  /** saturação por alumínio máxima tolerada, % */
  m_max: number;
  /** N de referência, kg/ha */
  N: number;
  /** P2O5 por classe de P do solo [MB, B, M, Bom, MBom], kg/ha */
  P: [number, number, number, number, number];
  /** K2O por classe de K do solo [MB, B, M, Bom, MBom], kg/ha */
  K: [number, number, number, number, number];
  /** texto de parcelamento, um item por época */
  parc: string[];
  /** observação de manejo */
  obs: string;
}

/** Fertilizante e teores de garantia (%). */
export interface Fertilizante {
  nome: string;
  N: number;
  P: number;
  K: number;
  extra: string;
}

/** Alvo fitossanitário e nível de controle. */
export interface Praga {
  cultura: string;
  alvo: string;
  nivel: string;
  metodo: string;
}

/** Conjunto completo de tabelas de referência de um escritório. */
export interface TabelasReferencia {
  faixas: Record<ChaveFaixa, Faixa>;
  fosforo: FaixaFosforo[];
  culturas: Record<string, Cultura>;
  fertilizantes: Fertilizante[];
  pragas: Praga[];
}

/** Índice de classe 0..4 (muito baixo .. muito bom). */
export type IndiceClasse = 0 | 1 | 2 | 3 | 4;

/** Resultado do cálculo do complexo sortivo e relações. */
export interface ResultadoCalculo {
  /** K convertido para cmolc/dm³ */
  Kc: number;
  /** Na convertido para cmolc/dm³ */
  Nac: number;
  /** soma de bases */
  SB: number;
  /** CTC efetiva (t) */
  t: number;
  /** CTC a pH 7 (T) */
  T: number;
  /** saturação por bases, % */
  V: number;
  /** saturação por alumínio, % */
  m: number;
  CaMg: number;
  CaK: number;
  MgK: number;
  /** participação de Ca na CTC a pH 7, % */
  partCa: number;
  partMg: number;
  partK: number;
  partHAl: number;
  faixaP: FaixaFosforo;
  classeP: IndiceClasse;
  classeK: IndiceClasse;
}

export interface Calagem {
  /** meta de V% adotada */
  V2: number;
  /** NC pelo método da saturação por bases, t/ha PRNT 100% */
  nc_sb: number;
  /** NC pelo método da neutralização do Al + Ca/Mg, t/ha PRNT 100% */
  nc_al: number;
  /** fator Y da textura */
  Y: number;
  /** o maior entre os dois métodos, t/ha PRNT 100% */
  escolhido: number;
  /** corrigido pelo PRNT real e pela profundidade de incorporação, t/ha */
  corrigido: number;
  fatorProf: number;
}

export type Corretivo = 'calcitico' | 'magnesiano' | 'dolomitico';

export interface EscolhaCorretivo {
  corretivo: Corretivo;
  motivo: string;
}

export interface Gessagem {
  precisa: boolean;
  /** dose indicativa, kg/ha (só vale com análise de 20-40 cm) */
  dose: number;
  criterio: string;
}

export interface Adubacao {
  N: number;
  P2O5: number;
  K2O: number;
  /** fator de escala aplicado sobre as doses de referência */
  fator: number;
  classeP: IndiceClasse;
  classeK: IndiceClasse;
}

export type GrauDiagnostico = 'crit' | 'atencao' | 'ok';

export interface ItemDiagnostico {
  g: GrauDiagnostico;
  txt: string;
}

export interface Fonte {
  nome: string;
  /** dose do produto comercial, kg/ha */
  dose: number;
  obs: string;
}

/** Entrada completa para gerar uma recomendação. */
export interface EntradaRecomendacao {
  analise: Analise;
  cultura?: Cultura;
  /** produtividade esperada do talhão (fallback quando a análise não traz) */
  prodEsperadaTalhao?: number;
  /** área do talhão em ha, para os totais */
  areaHa?: number;
  tabelas: TabelasReferencia;
}

/** Recomendação agronômica completa e rastreável. */
export interface Recomendacao {
  motor_versao: string;
  gerada_em: string;
  calculo: ResultadoCalculo;
  calagem: Calagem;
  corretivo: EscolhaCorretivo;
  gessagem: Gessagem;
  adubacao: Adubacao | null;
  fontes: Fonte[];
  diagnostico: ItemDiagnostico[];
  /** produtividade usada no cálculo */
  produtividade: number;
  areaHa: number;
  /** totais no talhão (dose/ha * área) */
  totais: {
    calcario_t: number;
    gesso_t: number;
    N_kg: number;
    P2O5_kg: number;
    K2O_kg: number;
  };
  /** cópia das tabelas usadas — congela a base do cálculo */
  tabelas_snapshot: TabelasReferencia;
}
