/**
 * Identidade de cada pedaço de uma visita (AG-007). Visita, ocorrências e fotos são gravadas em passos separados;
 * para o reenvio completar só o que falta — sem duplicar e sem perder — cada ocorrência e cada foto tem uma chave
 * derivada da chave da visita (a mesma que a fila offline guarda no aparelho). Funções puras, testadas.
 */

export const MAX_FOTOS = 6;
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;
export const MAX_OCORRENCIAS = 3;

export interface OcorrenciaDoForm { indice: number; alvo: string; valor: string | null; acima_nivel: boolean }

const texto = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

/** As ocorrências preenchidas, cada uma com a posição que tinha no formulário (1 a 3) — essa posição é a identidade. */
export function ocorrenciasDoForm(fd: Pick<FormData, 'get'>): OcorrenciaDoForm[] {
  const lista: OcorrenciaDoForm[] = [];
  for (let i = 1; i <= MAX_OCORRENCIAS; i++) {
    const alvo = texto(fd.get(`oc${i}_alvo`));
    if (!alvo) continue;
    lista.push({ indice: i, alvo, valor: texto(fd.get(`oc${i}_valor`)), acima_nivel: fd.get(`oc${i}_acima`) === 'on' });
  }
  return lista;
}

/** "<chave da visita>-f<posição>": igual no 1º envio e em qualquer reenvio da mesma foto. */
export function chaveDaFoto(chaveVisita: string, posicao: number): string {
  return `${chaveVisita}-f${posicao}`;
}

/**
 * Destino de cada foto do formulário:
 *  - "enviar": segue;  - "descartar": nunca vai dar certo (excesso, grande demais, não é imagem) — NÃO reenviar;
 * O motivo da falha transitória (rede/armazenamento) é decidido na hora do envio, não aqui.
 */
export type DestinoFoto = { posicao: number; destino: 'enviar' } | { posicao: number; destino: 'descartar'; motivo: string };

export function classificarFotos(tamanhos: readonly number[]): DestinoFoto[] {
  return tamanhos.map((tam, posicao) => {
    if (posicao >= MAX_FOTOS) return { posicao, destino: 'descartar', motivo: `passou do limite de ${MAX_FOTOS} fotos` };
    if (tam > MAX_BYTES_FOTO) return { posicao, destino: 'descartar', motivo: 'arquivo maior que 8 MB' };
    return { posicao, destino: 'enviar' };
  });
}
