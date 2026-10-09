/**
 * Regras de roteamento por sessão, sem dependência de Next/Supabase — para testar.
 * É conveniência de navegação; a barreira real é a RLS (doc §5.5) e os guardas dos layouts.
 *
 * O AgroTech tem três sites (lib/sites.ts): Assistência Técnica (/app e /produtor), Academy (/academy) e Connect (/connect).
 * A entrada é uma só (/login), com a escolha do site; cada site tem a sua área protegida.
 */
import { destinoDoSite, loginDoSite, type SiteId } from '../sites';

export type Papel = 'consultor' | 'admin' | 'produtor' | null;

/** Rotas que nunca exigem nem consultam a sessão. */
const PUBLICAS = ['/demo', '/r', '/offline', '/icones-pwa', '/privacidade', '/termos', '/api/saude'];
const PUBLICAS_EXATAS = ['/sw.js', '/manifest.webmanifest'];

const noSegmento = (caminho: string, base: string) => caminho === base || caminho.startsWith(base + '/');

export function ehPublica(caminho: string): boolean {
  return PUBLICAS_EXATAS.includes(caminho) || PUBLICAS.some((p) => noSegmento(caminho, p));
}

/** Telas de entrada: quem já tem sessão não precisa vê-las. Convites (/aceitar) ficam de fora. */
export function telaDeEntrada(caminho: string): 'consultor' | 'produtor' | null {
  if (caminho === '/login' || caminho === '/cadastro') return 'consultor';
  if (caminho === '/produtor/login') return 'produtor';
  return null;
}

export function areaConsultor(caminho: string): boolean {
  return noSegmento(caminho, '/app');
}

/** /produtor/* exceto login e aceitar (que são públicas dentro do prefixo). */
export function areaProdutor(caminho: string): boolean {
  return noSegmento(caminho, '/produtor') && !noSegmento(caminho, '/produtor/login') && !noSegmento(caminho, '/produtor/aceitar');
}

/** Os dois sites novos aceitam consultor e produtor: o que muda é o que cada um vê lá dentro. */
export function areaAcademy(caminho: string): boolean {
  return noSegmento(caminho, '/academy');
}
export function areaConnect(caminho: string): boolean {
  return noSegmento(caminho, '/connect');
}
/** "Trocar de site": só para quem já entrou. */
export function areaSites(caminho: string): boolean {
  return caminho === '/sites';
}

export function casaDoPapel(papel: Papel): string | null {
  if (papel === 'consultor' || papel === 'admin') return '/app';
  if (papel === 'produtor') return '/produtor';
  return null;
}

/**
 * Para onde redirecionar (ou null para seguir). Princípios:
 *  - sem sessão, só as áreas protegidas redirecionam, cada uma para o login do SEU site;
 *  - com sessão e papel conhecido, quem abre uma tela de entrada vai para o site que escolheu
 *    (abrir /login numa aba nova não deve pedir login de quem já entrou);
 *  - Assistência Técnica separa por papel (consultor × produtor); Academy e Connect recebem os dois papéis;
 *  - com sessão e papel DESCONHECIDO (perfil não carregou) nunca redireciona: o laço
 *    /app -> /produtor -> /app que isso gerava é pior que deixar o guarda do layout decidir.
 * O resultado pode trazer query (`/login?site=academy`).
 */
export function decidirRota(caminho: string, logado: boolean, papel: Papel, site: SiteId = 'assistencia'): string | null {
  if (ehPublica(caminho)) return null;

  if (!logado) {
    if (areaProdutor(caminho)) return loginDoSite('assistencia', 'produtor');
    if (areaConsultor(caminho)) return loginDoSite('assistencia');
    if (areaAcademy(caminho)) return loginDoSite('academy');
    if (areaConnect(caminho)) return loginDoSite('connect');
    if (areaSites(caminho)) return loginDoSite('assistencia');
    return null;
  }

  const casa = casaDoPapel(papel);
  if (!casa) return null;

  if (areaConsultor(caminho) && casa !== '/app') return casa;
  if (areaProdutor(caminho) && casa !== '/produtor') return casa;
  if (telaDeEntrada(caminho)) return caminho === '/cadastro' ? casa : destinoDoSite(site, papel);
  return null;
}

export function papelDeValor(valor: unknown): Papel {
  return valor === 'consultor' || valor === 'admin' || valor === 'produtor' ? valor : null;
}

/** Lê o papel do claim `user_role` do access token (injetado por agro.custom_access_token_hook). */
export function papelDoToken(accessToken: string | null | undefined): Papel {
  if (!accessToken) return null;
  try {
    const carga = accessToken.split('.')[1];
    if (!carga) return null;
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(carga.length / 4) * 4, '='));
    return papelDeValor((JSON.parse(json) as { user_role?: string }).user_role);
  } catch {
    return null;
  }
}

/** Falha de rede/servidor/limite no Auth: NÃO significa "sem sessão" e não pode deslogar. */
export function ehFalhaTransitoria(erro: { name?: string; status?: number } | null | undefined): boolean {
  if (!erro) return false;
  return erro.name === 'AuthRetryableFetchError' || (erro.status ?? 0) >= 500 || erro.status === 429;
}
