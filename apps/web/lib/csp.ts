/**
 * Content-Security-Policy com nonce por requisição.
 *
 * O que ela barra: script injetado (XSS) — só roda script que o servidor marcou com o nonce, e o que esse
 * script carregar (`strict-dynamic`); embutir o app em iframe; enviar formulário para fora; plugins.
 * Estilos ficam com 'unsafe-inline' (atributos `style` do React e o Leaflet precisam) — estilo não executa código.
 * Sem upgrade-insecure-requests de propósito: o HSTS (next.config.mjs) já força https e a diretiva quebra o teste local em http.
 *
 * Montada no proxy (proxy.ts, antigo middleware) a cada requisição; o Next lê o nonce do cabeçalho da requisição e o
 * coloca nos próprios scripts. Por isso o layout raiz força renderização dinâmica (página estática não tem nonce).
 */

export interface OpcoesCsp {
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL — a única origem de dados e de arquivos (fotos/PDF por URL assinada) */
  supabaseUrl?: string;
  /** dev precisa de eval (refresh rápido do React) e de websocket local */
  desenvolvimento?: boolean;
}

function origem(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function montarCsp({ nonce, supabaseUrl, desenvolvimento = false }: OpcoesCsp): string {
  const supa = origem(supabaseUrl);
  const supaWs = supa ? supa.replace(/^http/, 'ws') : null;

  const dir: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(desenvolvimento ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // fotos de visita e PDFs vêm do Storage por URL assinada; os mosaicos do mapa, do OpenStreetMap
    'img-src': ["'self'", 'data:', 'blob:', ...(supa ? [supa] : []), 'https://*.tile.openstreetmap.org'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(supa ? [supa] : []), ...(supaWs ? [supaWs] : []), ...(desenvolvimento ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:', ...(supa ? [supa] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const partes = Object.entries(dir).map(([nome, valores]) => `${nome} ${valores.join(' ')}`);
  return partes.join('; ');
}

/** Nonce de 128 bits em base64 (Web Crypto — roda no Edge do middleware). */
export function novoNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
