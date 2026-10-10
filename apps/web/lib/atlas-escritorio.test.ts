import { describe, expect, it } from 'vitest';
import { idsDeFichasNoTexto, partirComFichas, buscarFichas, maisImportantes } from './atlas';
import { FICHAS } from './atlas-base';
import { linhasDoTexto, paraFichaAtlas, textoDasLinhas, validarFicha, type EntradaFicha, type FichaDoBanco } from './atlas-escritorio';

const ID = '63aaaaaa-0000-0000-0000-000000000001';
const entrada = (o: Partial<EntradaFicha> = {}): EntradaFicha => ({
  tipo: 'doenca', nome: 'Mancha de phoma', cientifico: '', outros_nomes: '', cultura: 'Café', partes: ['folha'],
  importancia_campo: 'alta', importancia_viveiro: '', sobre: 'Doença de folhas novas.', favorecem: '', manejo: '', monitoramento: '',
  confunde: '', fonte: '', url: '', ...o,
});

describe('linhas do texto', () => {
  it('um item por linha, sem espaços nem linhas vazias', () => {
    expect(linhasDoTexto('  um \r\n\r\n dois\n   \ntrês  ')).toEqual(['um', 'dois', 'três']);
    expect(linhasDoTexto('')).toEqual([]);
    expect(textoDasLinhas(['a', 'b'])).toBe('a\nb');
    expect(textoDasLinhas(null)).toBe('');
  });
});

describe('validar a ficha', () => {
  it('ficha completa passa e vem normalizada', () => {
    const r = validarFicha(entrada({ nome: '  Mancha de phoma  ', favorecem: ' frio \n\n vento ', partes: ['folha', 'folha', 'ramo'] }), true, true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados).toMatchObject({ nome: 'Mancha de phoma', favorecem: ['frio', 'vento'], partes: ['folha', 'ramo'], importancia_campo: 'alta', importancia_viveiro: null, cientifico: null });
    }
  });

  it('rascunho aceita quase tudo vazio (só precisa de tipo e nome)', () => {
    expect(validarFicha(entrada({ sobre: '', partes: [], importancia_campo: '' }), false, false).ok).toBe(true);
  });

  it('para publicar exige texto, parte da planta e foto — com mensagem clara', () => {
    expect(validarFicha(entrada({ sobre: '' }), true, true)).toEqual({ ok: false, erro: expect.stringContaining('o que é') });
    expect(validarFicha(entrada({ partes: [] }), true, true)).toEqual({ ok: false, erro: expect.stringContaining('onde aparece') });
    expect(validarFicha(entrada(), true, false)).toEqual({ ok: false, erro: expect.stringContaining('foto') });
  });

  it('recusa tipo, nome, parte e importância inválidos', () => {
    expect(validarFicha(entrada({ tipo: 'bruxaria' }), false, false).ok).toBe(false);
    expect(validarFicha(entrada({ nome: 'ab' }), false, false).ok).toBe(false);
    expect(validarFicha(entrada({ nome: 'x'.repeat(121) }), false, false).ok).toBe(false);
    expect(validarFicha(entrada({ partes: ['folha', 'asa'] }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('Parte') });
    expect(validarFicha(entrada({ importancia_campo: 'enorme' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('Importância') });
  });

  it('limita as listas (12 linhas, tamanho por linha) e o link só aceita https', () => {
    const treze = Array.from({ length: 13 }, (_, i) => `linha ${i}`).join('\n');
    expect(validarFicha(entrada({ manejo: treze }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('mais de 12 linhas') });
    expect(validarFicha(entrada({ manejo: 'x'.repeat(901) }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('900') });
    expect(validarFicha(entrada({ manejo: 'x'.repeat(900) }), false, false).ok).toBe(true);
    for (const url of ['http://a.com/x', 'javascript:alert(1)', 'https://com espaço.com']) expect(validarFicha(entrada({ url }), false, false).ok, url).toBe(false);
    expect(validarFicha(entrada({ url: 'https://www.embrapa.br/cafe' }), false, false).ok).toBe(true);
  });
});

describe('ficha do escritório no formato do Atlas', () => {
  const linha: FichaDoBanco = {
    id: ID, tipo: 'doenca', nome: 'Mancha de phoma', cientifico: 'Phoma tarda', outros_nomes: 'mancha-de-phoma; seca de ramos', cultura: 'Café',
    partes: ['folha', 'ramo'], importancia_campo: 'extrema', importancia_viveiro: null, sobre: ['Texto.'], favorecem: ['Frio.'], manejo: ['Podar.'],
    monitoramento: [], confunde: null, fonte: 'Manual do escritório', url: null, status: 'publicado', publicado_em: null,
  };

  it('converte campos, importância e origem', () => {
    const f = paraFichaAtlas(linha, ['https://x/y.jpg']);
    expect(f).toMatchObject({ slug: ID, tipo: 'doenca', origem: 'escritorio', fotos: 1, fotoUrls: ['https://x/y.jpg'], cientifico: 'Phoma tarda', cultura: 'Café', fonteTexto: 'Manual do escritório' });
    expect(f.importancia).toEqual({ campo: 'Extrema', viveiro: '—' });
    expect(f.outrosNomes).toEqual(['mancha-de-phoma', 'seca de ramos']);
    expect(f.monitoramento).toBeUndefined();
  });

  it('"outro problema" fica entre as pragas na tela', () => {
    expect(paraFichaAtlas({ ...linha, tipo: 'outro' }, []).tipo).toBe('praga');
  });

  it('entra na busca, nos filtros e nas "mais importantes" junto com as fichas-base', () => {
    const todas = [...FICHAS, paraFichaAtlas(linha, ['https://x/y.jpg'])];
    expect(buscarFichas({ q: 'phoma' }, todas).map((f) => f.slug)).toEqual([ID]);
    expect(buscarFichas({ parte: 'ramo', tipo: 'doenca' }, todas).map((f) => f.slug)).toContain(ID);
    expect(maisImportantes(todas, 30).map((f) => f.slug)).toContain(ID);
  });
});

describe('links de fichas do escritório na conversa', () => {
  const nomes = new Map([[ID, 'Mancha de phoma']]);
  it('acha os ids citados', () => {
    expect(idsDeFichasNoTexto(`veja /academy/atlas/${ID} e /academy/atlas/broca-do-cafe e /academy/atlas/${ID}`)).toEqual([ID]);
    expect(idsDeFichasNoTexto('nada aqui')).toEqual([]);
  });
  it('vira link só quando o nome é conhecido', () => {
    expect(partirComFichas(`Veja: /academy/atlas/${ID}`, nomes)).toEqual([
      { tipo: 'texto', valor: 'Veja: ' },
      { tipo: 'ficha', slug: ID, nome: 'Mancha de phoma' },
    ]);
    expect(partirComFichas(`Veja: /academy/atlas/${ID}`)).toEqual([{ tipo: 'texto', valor: `Veja: /academy/atlas/${ID}` }]);
  });
  it('as fichas-base continuam funcionando sem o mapa', () => {
    expect(partirComFichas('/academy/atlas/broca-do-cafe')).toEqual([{ tipo: 'ficha', slug: 'broca-do-cafe', nome: 'Broca-do-café' }]);
  });
});
