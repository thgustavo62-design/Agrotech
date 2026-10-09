export * from './tipos.js';
export { parseNumeroBR, norm } from './numero.js';
export { SANIDADE, dentroDaFaixa } from './sanidade.js';
export { PERFIS, detectarPerfil } from './perfis.js';
export { extrairDeTexto, extrairDeLeiturasOcr } from './extrair.js';
export { extrairTabelaHorizontal } from './horizontal.js';
export { extrairLote, ehLaudoEmTabela, type FonteTexto } from './lote/index.js';
export { LINHAS } from './lote/formato.js';
export {
  CONFIANCA_MAX_LLM, ESQUEMA_LAUDO, montarPrompt, interpretarResposta, normalizarComLLM,
} from './normalizar.js';
export type { PromptLLM } from './normalizar.js';
