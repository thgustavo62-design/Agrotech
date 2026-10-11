/** Regras puras do certificado (Academy): como o código é lido e o endereço de conferência. */

/**
 * O que a pessoa digitou → o código no formato do banco. Tolera minúsculas, espaços, o travessão do Word (–/—), e a falta dos
 * hifens ("at1a2b3c4d5e"). Se não der para entender, devolve o texto limpo e a validação de formato dirá que está errado.
 */
export function normalizarCodigo(bruto: string): string {
  const limpo = bruto.normalize('NFKC').toUpperCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, '');
  const m = /^AT-?([0-9A-F]{5})-?([0-9A-F]{5})$/.exec(limpo);
  return m ? `AT-${m[1]}-${m[2]}` : limpo;
}

/** Endereço onde qualquer pessoa confere o certificado (base sem barra final; sem base devolve o caminho relativo). */
export function enderecoDeConferencia(base: string | null | undefined, codigo: string): string {
  const raiz = (base ?? '').trim().replace(/\/+$/, '');
  return `${raiz}/validar?codigo=${encodeURIComponent(codigo)}`;
}
