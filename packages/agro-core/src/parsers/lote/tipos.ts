/** Tipos internos da leitura de laudo em tabela. */

export type FonteTexto = 'texto' | 'ocr';

export type Peso = 'limpo' | 'reconstituido' | 'posicional';
export interface Candidato { valor: number; peso: Peso; passada: number }

