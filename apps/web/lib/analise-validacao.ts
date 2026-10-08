import { REGRAS, informado, type ResultadoValidacaoAnalise } from '@agrotech/agro-core';

/**
 * Mensagem curta (cabe no aviso de 300 caracteres) do que impede a emissão: o que FALTA e o que está INVÁLIDO.
 * O detalhe completo de cada item vai na tela da análise (`erros[].mensagem`).
 */
export function mensagemDeBloqueio(v: ResultadoValidacaoAnalise, bruto: Record<string, unknown> = {}): string {
  if (v.ok) return '';
  const faltam = v.erros.filter((e) => !informado(bruto[e.campo])).map((e) => REGRAS[e.campo].rotulo);
  const invalidos = v.erros.filter((e) => informado(bruto[e.campo])).map((e) => REGRAS[e.campo].rotulo);
  const partes: string[] = [];
  if (faltam.length) partes.push(`faltam ${faltam.join(', ')}`);
  if (invalidos.length) partes.push(`valor inválido em ${invalidos.join(', ')}`);
  return `Não é possível emitir: ${partes.join('; ')}. Complete a análise e tente de novo.`;
}
