/** Regras da senha (mesmo mínimo do cadastro: 10 caracteres) e um medidor de força simples. */

export const MINIMO_SENHA = 10;

export interface RegraSenha {
  texto: string;
  ok: boolean;
}

export function regrasDaSenha(senha: string): RegraSenha[] {
  return [
    { texto: `Pelo menos ${MINIMO_SENHA} caracteres`, ok: senha.length >= MINIMO_SENHA },
    { texto: 'Letras e números', ok: /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha) },
  ];
}

/** 0 (vazia) a 4 (forte): comprimento, mistura de maiúsculas/minúsculas, número e símbolo. */
export function nivelDaSenha(senha: string): 0 | 1 | 2 | 3 | 4 {
  if (!senha) return 0;
  let pontos = 0;
  if (senha.length >= MINIMO_SENHA) pontos++;
  if (senha.length >= 14) pontos++;
  if (/[a-zà-ÿ]/.test(senha) && /[A-ZÀ-ß]/.test(senha)) pontos++;
  if (/\d/.test(senha) && /[^A-Za-z0-9À-ÿ]/.test(senha)) pontos++;
  return Math.max(1, Math.min(4, pontos)) as 1 | 2 | 3 | 4;
}
