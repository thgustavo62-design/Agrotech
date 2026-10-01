/** Tipos da camada de ingestão de laudo (texto -> campos com confiança). */

export type ChaveCampoLaudo =
  | 'argila' | 'ph' | 'mo' | 'p' | 'k' | 'na'
  | 'ca' | 'mg' | 'al' | 'h_al'
  | 's' | 'b' | 'zn' | 'cu' | 'mn' | 'fe';

export interface CampoPerfil {
  /** rótulos aceitos, do mais canônico ao sinônimo */
  rotulos: string[];
  /** unidade esperada quando o laudo não imprime */
  unidade: string;
  /** ajuste de valor conforme o rótulo casado e a unidade detectada na linha */
  transform?: (valor: number, rotulo: string, unidadeDetectada: string) => number;
}

export interface PerfilLab {
  id: string;
  /** todas precisam casar no texto para o perfil ser escolhido */
  assinatura: RegExp[];
  campos: Partial<Record<ChaveCampoLaudo, CampoPerfil>>;
  identificacao: Record<string, string[]>;
}

export interface CampoExtraido {
  valor: number | null;
  /** 0..1 — abaixo de 0,90 vai destacado para conferência */
  confianca: number;
  /** como o valor foi obtido (rótulo casado, LLM, etc.) */
  origem: string;
  /** trecho do laudo que originou o valor */
  bruto?: string;
}

/** Uma amostra de um laudo em tabela (várias amostras em colunas). */
export interface AmostraLaudo {
  /** posição da coluna, a partir de 1 */
  indice: number;
  /** código do laboratório (ex.: SCP-1-291088-2) */
  numero_lab: string | null;
  /** identificação dada pelo cliente (ex.: "Amostra 02 - Setor II Café") */
  rotulo: string | null;
  campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>>;
  /** valores impressos que o motor recalcula (SB, T, V, m, pH CaCl2...) — só para conferência */
  extras: Record<string, CampoExtraido>;
}

export interface ExtracaoLaudo {
  perfil: string | null;
  laboratorio: string | null;
  /** 'texto' = texto nativo do PDF; 'ocr' = PDF escaneado lido por OCR */
  fonte?: 'texto' | 'ocr';
  /** campos da PRIMEIRA amostra (compatível com laudos de uma amostra só) */
  campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>>;
  /** presente nos laudos em tabela; uma entrada por coluna */
  amostras?: AmostraLaudo[];
  identificacao: Record<string, string | null>;
  confianca_media: number;
  avisos: string[];
}
