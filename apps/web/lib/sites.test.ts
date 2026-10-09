import { describe, expect, it } from 'vitest';
import { SITES, SITES_ORDEM, destinoDoSite, loginDoSite, siteDeValor } from './sites';

describe('sites do AgroTech', () => {
  it('são três, na ordem do login', () => {
    expect(SITES_ORDEM).toEqual(['assistencia', 'academy', 'connect']);
    for (const id of SITES_ORDEM) expect(SITES[id].id).toBe(id);
  });

  it('qualquer valor vira um site válido; o padrão é a Assistência Técnica', () => {
    expect(siteDeValor('academy')).toBe('academy');
    expect(siteDeValor('connect')).toBe('connect');
    expect(siteDeValor('assistencia')).toBe('assistencia');
    for (const lixo of [undefined, null, '', 'admin', '../app', 'ACADEMY', 42, {}]) expect(siteDeValor(lixo)).toBe('assistencia');
  });

  it('o destino depois do login depende do site e, na Assistência, do papel', () => {
    expect(destinoDoSite('assistencia', 'consultor')).toBe('/app');
    expect(destinoDoSite('assistencia', 'admin')).toBe('/app');
    expect(destinoDoSite('assistencia', 'produtor')).toBe('/produtor');
    for (const papel of ['consultor', 'admin', 'produtor'] as const) {
      expect(destinoDoSite('academy', papel)).toBe('/academy');
      expect(destinoDoSite('connect', papel)).toBe('/connect');
    }
    expect(destinoDoSite('academy', null)).toBeNull();
  });

  it('o link de login já abre no site certo', () => {
    expect(loginDoSite('academy')).toBe('/login?site=academy');
    expect(loginDoSite('assistencia', 'produtor')).toBe('/login?site=assistencia&como=produtor');
  });
});
