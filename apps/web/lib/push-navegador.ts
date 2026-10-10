/** Utilitários do navegador para os avisos no celular (sem estado; testáveis fora do navegador). */

/** A chave pública vem em base64 url; o navegador pede bytes. */
export function chaveParaBytes(base64url: string): Uint8Array {
  const preenchida = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = preenchida.replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

/** Bytes de uma chave do navegador de volta para base64 url (o formato que o servidor guarda). */
export function bytesParaChave(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  let s = '';
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type SituacaoDosAvisos = 'sem-suporte' | 'precisa-instalar' | 'bloqueado' | 'desligado' | 'ligado';

/** O que a tela mostra, a partir do que o aparelho informa. iPhone só recebe aviso com o app instalado na tela inicial. */
export function situacaoDosAvisos(e: { temServiceWorker: boolean; temPush: boolean; temNotificacao: boolean; permissao: string; assinado: boolean; ehIos: boolean; instalado: boolean }): SituacaoDosAvisos {
  if (e.ehIos && !e.instalado) return 'precisa-instalar';
  if (!e.temServiceWorker || !e.temPush || !e.temNotificacao) return 'sem-suporte';
  if (e.permissao === 'denied') return 'bloqueado';
  return e.assinado && e.permissao === 'granted' ? 'ligado' : 'desligado';
}
