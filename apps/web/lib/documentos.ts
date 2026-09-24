/** Rótulo + tom de cada status de `agro.documentos` — compartilhado entre a lista global de laudos e a aba Documentos da Visão 360º do produtor. */
export const ROTULO_STATUS_DOCUMENTO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  recebido: { txt: 'na fila', tom: 'cinza' },
  extraindo: { txt: 'extraindo', tom: 'cinza' },
  extraido: { txt: 'extraído', tom: 'cinza' },
  revisao: { txt: 'aguardando conferência', tom: 'alerta' },
  confirmado: { txt: 'confirmado', tom: 'ok' },
  erro: { txt: 'erro', tom: 'ruim' },
};
