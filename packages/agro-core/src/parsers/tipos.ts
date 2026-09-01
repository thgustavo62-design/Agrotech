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

export interface ExtracaoLaudo {
  perfil: string | null;
  laboratorio: string | null;
  campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>>;
  identificacao: Record<string, string | null>;
  confianca_media: number;
  avisos: string[];
}
