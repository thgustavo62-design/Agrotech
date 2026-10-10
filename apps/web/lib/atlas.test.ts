import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FICHAS, fotosDaFicha } from './atlas-base';
import { buscarFichas, linksDePesquisa, partirComFichas, textoDaFicha } from './atlas';

describe('fichas-base do Atlas', () => {
  it('são 12 doenças e 7 pragas, com slug único', () => {
    expect(FICHAS.filter((f) => f.tipo === 'doenca')).toHaveLength(12);
    expect(FICHAS.filter((f) => f.tipo === 'praga')).toHaveLength(7);
    expect(new Set(FICHAS.map((f) => f.slug)).size).toBe(FICHAS.length);
  });

  it('toda foto prometida existe em public/atlas', () => {
    for (const f of FICHAS) {
      expect(f.fotos, f.slug).toBeGreaterThan(0);
      for (const url of fotosDaFicha(f)) expect(existsSync(join(__dirname, '..', 'public', url)), url).toBe(true);
    }
  });

  it('não traz dose nem nome de produto (a decisão é do agrônomo)', () => {
    const texto = FICHAS.flatMap((f) => [...f.sobre, ...f.manejo, ...(f.monitoramento ?? [])]).join(' ');
    // doses como "1,0 L/ha", "500 g/ha" ou "kg/ha"
    expect(texto).not.toMatch(/\d\s*(?:L|mL|kg|g)\s*\/\s*(?:ha|100 ?L)/i);
    // princípios ativos que o documento original lista nas tabelas
    for (const ativo of ['clorpirifós', 'abamectina', 'tebuconazol', 'azoxistrobina', 'mancozebe', 'deltametrina', 'imidacloprido']) {
      expect(texto.toLowerCase(), ativo).not.toContain(ativo);
    }
  });

  it('cada ficha cita a fonte e a autoria das fotos', () => {
    for (const f of FICHAS) {
      expect(f.creditos, f.slug).toMatch(/Embrapa/);
      expect(f.sobre.length, f.slug).toBeGreaterThan(0);
      expect(f.manejo.length, f.slug).toBeGreaterThan(0);
    }
  });
});

describe('busca no Atlas', () => {
  it('sem filtro devolve tudo; o tipo restringe', () => {
    expect(buscarFichas({})).toHaveLength(19);
    expect(buscarFichas({ tipo: 'praga' })).toHaveLength(7);
    expect(buscarFichas({ tipo: 'doenca' })).toHaveLength(12);
    expect(buscarFichas({ tipo: 'qualquer' })).toHaveLength(19);
  });

  it('acha por nome, nome científico, outro nome e parte da planta, sem acento', () => {
    expect(buscarFichas({ q: 'ferrugem' }).map((f) => f.slug)).toContain('ferrugem-alaranjada');
    expect(buscarFichas({ q: 'hemileia' }).map((f) => f.slug)).toEqual(['ferrugem-alaranjada']);
    expect(buscarFichas({ q: 'koleroga' }).map((f) => f.slug)).toEqual(['queima-do-fio']);
    expect(buscarFichas({ q: 'olho de perdiz' }).map((f) => f.slug)).toEqual(['cercosporiose']);
    expect(buscarFichas({ q: 'fruto' }).map((f) => f.slug)).toContain('broca-do-cafe');
    expect(buscarFichas({ q: 'cochonilha' })).toHaveLength(2);
    expect(buscarFichas({ q: 'nematoide raiz' }).map((f) => f.slug)).toContain('nematoide-das-galhas');
  });

  it('o nome vem antes do texto e a busca sem resultado volta vazia', () => {
    expect(buscarFichas({ q: 'broca' })[0]!.slug).toMatch(/^broca-/);
    expect(buscarFichas({ q: 'zzzzzz' })).toEqual([]);
    expect(buscarFichas({ q: 'ferrugem', tipo: 'praga' })).toEqual([]);
  });
});

describe('atalhos e referências', () => {
  it('links de pesquisa só abrem a busca (https) nos dois sites', () => {
    const l = linksDePesquisa('ferrugem do café');
    expect(l.map((x) => x.rotulo)).toEqual(['Procurar na Embrapa', 'Procurar no Incaper']);
    for (const x of l) expect(x.url).toMatch(/^https:\/\/www\.google\.com\/search\?q=/);
    expect(decodeURIComponent(l[0]!.url)).toContain('site:embrapa.br');
    expect(decodeURIComponent(l[1]!.url)).toContain('site:incaper.es.gov.br');
    expect(linksDePesquisa('   ')).toEqual([]);
  });

  it('o texto da resposta aponta a ficha e a conversa transforma em link só fichas que existem', () => {
    const t = textoDaFicha({ slug: 'broca-do-cafe', nome: 'Broca-do-café' });
    expect(t).toBe('Veja a ficha do Atlas sobre Broca-do-café: /academy/atlas/broca-do-cafe');
    expect(partirComFichas(`${t} Qualquer dúvida, chame.`)).toEqual([
      { tipo: 'texto', valor: 'Veja a ficha do Atlas sobre Broca-do-café: ' },
      { tipo: 'ficha', slug: 'broca-do-cafe', nome: 'Broca-do-café' },
      { tipo: 'texto', valor: ' Qualquer dúvida, chame.' },
    ]);
    expect(partirComFichas('veja /academy/atlas/inventada agora')).toEqual([{ tipo: 'texto', valor: 'veja /academy/atlas/inventada agora' }]);
    expect(partirComFichas('sem link')).toEqual([{ tipo: 'texto', valor: 'sem link' }]);
  });
});
