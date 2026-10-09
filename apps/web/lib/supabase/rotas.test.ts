import { describe, expect, it } from 'vitest';
import { decidirRota, ehFalhaTransitoria, ehPublica, papelDoToken } from './rotas';

const token = (claims: object) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

describe('decidirRota — sem sessão', () => {
  it('cada área vai para o login do SEU site', () => {
    expect(decidirRota('/app', false, null)).toBe('/login?site=assistencia');
    expect(decidirRota('/app/talhoes/1', false, null)).toBe('/login?site=assistencia');
    expect(decidirRota('/produtor', false, null)).toBe('/login?site=assistencia&como=produtor');
    expect(decidirRota('/produtor/laudos/9', false, null)).toBe('/login?site=assistencia&como=produtor');
    expect(decidirRota('/academy', false, null)).toBe('/login?site=academy');
    expect(decidirRota('/academy/cursos/abc', false, null)).toBe('/login?site=academy');
    expect(decidirRota('/connect', false, null)).toBe('/login?site=connect');
    expect(decidirRota('/sites', false, null)).toBe('/login?site=assistencia');
  });

  it('telas de entrada, convites e páginas públicas seguem', () => {
    for (const c of ['/login', '/cadastro', '/produtor/login', '/produtor/aceitar', '/equipe/aceitar', '/redefinir-senha', '/verificar-codigo', '/api/saude', '/demo', '/demo/tabelas', '/r/abc', '/offline', '/sw.js', '/privacidade', '/termos', '/']) {
      expect(decidirRota(c, false, null), c).toBeNull();
    }
  });

  it('prefixo só de texto não é a área: /apple-icon e /appx não pedem login', () => {
    expect(decidirRota('/apple-icon', false, null)).toBeNull();
    expect(decidirRota('/appx', false, null)).toBeNull();
    expect(decidirRota('/produtores', false, null)).toBeNull();
  });
});

describe('decidirRota — com sessão', () => {
  it('quem já entrou não vê de novo as telas de login/cadastro', () => {
    expect(decidirRota('/login', true, 'consultor')).toBe('/app');
    expect(decidirRota('/cadastro', true, 'admin')).toBe('/app');
    expect(decidirRota('/produtor/login', true, 'produtor')).toBe('/produtor');
    expect(decidirRota('/login', true, 'produtor')).toBe('/produtor');
    expect(decidirRota('/produtor/login', true, 'consultor')).toBe('/app');
  });

  it('convite continua acessível mesmo logado', () => {
    expect(decidirRota('/produtor/aceitar', true, 'consultor')).toBeNull();
    expect(decidirRota('/equipe/aceitar', true, 'produtor')).toBeNull();
  });

  it('cada papel fica na sua área', () => {
    expect(decidirRota('/app/analises', true, 'consultor')).toBeNull();
    expect(decidirRota('/app', true, 'produtor')).toBe('/produtor');
    expect(decidirRota('/produtor/laudos', true, 'produtor')).toBeNull();
    expect(decidirRota('/produtor', true, 'consultor')).toBe('/app');
  });

  it('quem já entrou e abre o login vai para o site que escolheu', () => {
    expect(decidirRota('/login', true, 'consultor', 'academy')).toBe('/academy');
    expect(decidirRota('/login', true, 'produtor', 'academy')).toBe('/academy');
    expect(decidirRota('/login', true, 'produtor', 'connect')).toBe('/connect');
    expect(decidirRota('/login', true, 'consultor', 'connect')).toBe('/connect');
    expect(decidirRota('/login', true, 'produtor', 'assistencia')).toBe('/produtor');
    expect(decidirRota('/login', true, 'admin')).toBe('/app');
    expect(decidirRota('/cadastro', true, 'consultor', 'academy')).toBe('/app'); // criar escritório é da Assistência
  });

  it('Academy e Connect recebem consultor e produtor, sem empurrar ninguém para outra área', () => {
    for (const papel of ['consultor', 'admin', 'produtor'] as const) {
      expect(decidirRota('/academy/cursos', true, papel), papel).toBeNull();
      expect(decidirRota('/connect/atendimentos', true, papel), papel).toBeNull();
      expect(decidirRota('/sites', true, papel), papel).toBeNull();
    }
  });

  it('as áreas antigas continuam separadas por papel', () => {
    expect(decidirRota('/app', true, 'produtor', 'academy')).toBe('/produtor');
    expect(decidirRota('/produtor', true, 'consultor', 'academy')).toBe('/app');
  });

  it('prefixo só de texto não é o site: /academyx e /connected não pedem login', () => {
    expect(decidirRota('/academyx', false, null)).toBeNull();
    expect(decidirRota('/connected', false, null)).toBeNull();
  });

  it('papel desconhecido nunca redireciona (evita o laço /app <-> /produtor)', () => {
    for (const c of ['/app', '/produtor', '/login', '/produtor/login']) expect(decidirRota(c, true, null), c).toBeNull();
  });
});

describe('papelDoToken', () => {
  it('lê o claim user_role', () => {
    expect(papelDoToken(token({ user_role: 'produtor' }))).toBe('produtor');
    expect(papelDoToken(token({ user_role: 'consultor' }))).toBe('consultor');
  });
  it('token sem claim, valor estranho ou lixo viram null', () => {
    expect(papelDoToken(token({}))).toBeNull();
    expect(papelDoToken(token({ user_role: 'root' }))).toBeNull();
    expect(papelDoToken('lixo')).toBeNull();
    expect(papelDoToken(null)).toBeNull();
  });
});

describe('ehFalhaTransitoria', () => {
  it('rede, 5xx e 429 não deslogam; erro de credencial sim', () => {
    expect(ehFalhaTransitoria({ name: 'AuthRetryableFetchError', status: 0 })).toBe(true);
    expect(ehFalhaTransitoria({ name: 'AuthApiError', status: 503 })).toBe(true);
    expect(ehFalhaTransitoria({ name: 'AuthApiError', status: 429 })).toBe(true);
    expect(ehFalhaTransitoria({ name: 'AuthApiError', status: 400 })).toBe(false);
    expect(ehFalhaTransitoria({ name: 'AuthSessionMissingError', status: 400 })).toBe(false);
    expect(ehFalhaTransitoria(null)).toBe(false);
  });
});

describe('ehPublica', () => {
  it('confere limite de segmento', () => {
    expect(ehPublica('/r/token')).toBe(true);
    expect(ehPublica('/relatorio')).toBe(false);
  });
});
