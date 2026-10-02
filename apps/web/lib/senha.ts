/** Regras da senha (mesmo mínimo do cadastro e do Supabase: 8 caracteres) e um medidor de força simples. */

export const MINIMO_SENHA = 8;

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
  if (senha.length >= 12) pontos++;
  if (/[a-zà-ÿ]/.test(senha) && /[A-ZÀ-ß]/.test(senha)) pontos++;
  if (/\d/.test(senha) && /[^A-Za-z0-9À-ÿ]/.test(senha)) pontos++;
  return Math.max(1, Math.min(4, pontos)) as 1 | 2 | 3 | 4;
}

// sem caracteres que se confundem ao ler/ditar (0/O, 1/l/I)
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';

function sortear(alfabeto: string): string {
  // rejeição para não enviesar o sorteio (256 não é múltiplo do tamanho do alfabeto)
  const limite = 256 - (256 % alfabeto.length);
  const um = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(um);
    if (um[0]! < limite) return alfabeto[um[0]! % alfabeto.length]!;
  }
}

/** Senha provisória legível (letras e números sem ambiguidade). Sempre passa nas regras de `regrasDaSenha`. */
export function gerarSenha(tamanho = 10): string {
  const n = Math.max(tamanho, MINIMO_SENHA);
  const chars = [sortear(DIGITOS), sortear(LETRAS)];
  while (chars.length < n) chars.push(sortear(LETRAS + DIGITOS));
  // embaralha (Fisher–Yates) para o dígito obrigatório não ficar sempre na frente
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
