/**
 * Log de erros em uma linha JSON por evento (o Vercel indexa e filtra por campo). Sem dependência externa.
 *
 * Regras: nunca registrar senha, token, CPF/CNPJ, e-mail completo nem o conteúdo de laudos — só o contexto, o código do
 * erro e quem/onde (ids). `limpar` corta o que parecer segredo antes de gravar, como segunda linha de defesa.
 */

export type NivelLog = 'erro' | 'aviso' | 'info';

const SEGREDOS = /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*|Bearer\s+\S+|sb_secret_\S+|service_role\S*|(?:senha|password|token|apikey|api_key|secret)["']?\s*[:=]\s*["']?[^\s"',}]+)/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Remove JWTs, chaves e senhas óbvias de um texto e esconde o usuário do e-mail. */
export function limpar(texto: string): string {
  return texto.replace(SEGREDOS, '[omitido]').replace(EMAIL, '***@$1').slice(0, 600);
}

export interface EventoLog {
  nivel: NivelLog;
  /** onde: "acao.registrarVisita", "pagina.talhao", "proxy" … */
  contexto: string;
  mensagem: string;
  codigo?: string | null;
  /** identificador da requisição (x-vercel-id) para achar o resto no painel do Vercel */
  requisicao?: string | null;
  /** ids e números, nunca dados pessoais */
  extra?: Record<string, string | number | boolean | null | undefined>;
}

export function montarLinha(e: EventoLog, agora: Date = new Date()): string {
  return JSON.stringify({
    t: agora.toISOString(),
    nivel: e.nivel,
    contexto: e.contexto,
    mensagem: limpar(e.mensagem),
    codigo: e.codigo ?? undefined,
    requisicao: e.requisicao ?? undefined,
    extra: e.extra,
  });
}

export function registrarEvento(e: EventoLog): void {
  const linha = montarLinha(e);
  if (e.nivel === 'erro') console.error(linha);
  else if (e.nivel === 'aviso') console.warn(linha);
  else console.log(linha);
}

/** Atalho para `catch`: aceita Error, objeto do Supabase ({ message, code }) ou qualquer coisa. */
export function registrarErro(contexto: string, erro: unknown, extra?: EventoLog['extra'], requisicao?: string | null): void {
  const o = (typeof erro === 'object' && erro !== null ? erro : {}) as { message?: unknown; code?: unknown; name?: unknown };
  registrarEvento({
    nivel: 'erro',
    contexto,
    mensagem: typeof o.message === 'string' ? o.message : String(erro),
    codigo: typeof o.code === 'string' ? o.code : typeof o.name === 'string' ? o.name : null,
    requisicao,
    extra,
  });
}
