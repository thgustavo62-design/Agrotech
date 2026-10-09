import { describe, expect, it } from 'vitest';
import {
  dominioDoLink, filtrarConteudos, linkSeguro, nomeSeguroDeArquivo, normalizarBusca, situacaoDaIndicacao,
  validarConteudo, type EntradaConteudo,
} from './academy';

const base: EntradaConteudo = {
  tipo: 'video', titulo: 'Calagem em café', descricao: '', cultura: 'Café', tema: 'calagem', nivel: 'basico',
  duracao_min: '12', url: 'https://youtu.be/abc123', corpo: '', fonte: 'Embrapa', visibilidade: 'todos',
};
const com = (o: Partial<EntradaConteudo>): EntradaConteudo => ({ ...base, ...o });

describe('link seguro', () => {
  it('aceita só https com endereço de verdade', () => {
    expect(linkSeguro('https://youtu.be/abc')).toBe('https://youtu.be/abc');
    expect(linkSeguro('  https://www.embrapa.br/e-campo  ')).toBe('https://www.embrapa.br/e-campo');
  });
  it('recusa http, javascript, data, sem ponto e com espaço', () => {
    for (const ruim of ['http://exemplo.com', 'javascript:alert(1)', 'data:text/html,x', 'https://localhost', 'https://com espaço.com', 'ftp://a.com/x', '', 'youtube.com/abc']) {
      expect(linkSeguro(ruim)).toBeNull();
    }
  });
});

describe('validar o formulário do conteúdo', () => {
  it('vídeo completo passa e vem normalizado', () => {
    const r = validarConteudo(base, true, false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados).toMatchObject({ tipo: 'video', titulo: 'Calagem em café', duracao_min: 12, tema: 'calagem', descricao: null, corpo: null });
    }
  });

  it('título curto, tipo e nível inválidos são explicados', () => {
    expect(validarConteudo(com({ titulo: 'ab' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('título') });
    expect(validarConteudo(com({ tipo: 'filme' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('tipo') });
    expect(validarConteudo(com({ nivel: 'expert' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('nível') });
    expect(validarConteudo(com({ tema: 'astrologia' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('Tema') });
  });

  it('duração: minutos inteiros de 1 a 600', () => {
    expect(validarConteudo(com({ duracao_min: '0' }), false, false).ok).toBe(false);
    expect(validarConteudo(com({ duracao_min: '601' }), false, false).ok).toBe(false);
    expect(validarConteudo(com({ duracao_min: '7,5' }), false, false).ok).toBe(false);
    expect(validarConteudo(com({ duracao_min: '' }), false, false).ok).toBe(true);
  });

  it('link errado é recusado mesmo em rascunho', () => {
    expect(validarConteudo(com({ url: 'http://exemplo.com' }), false, false)).toEqual({ ok: false, erro: expect.stringContaining('https://') });
  });

  it('rascunho incompleto pode ser salvo; publicar exige o que mostrar', () => {
    expect(validarConteudo(com({ url: '' }), false, false).ok).toBe(true);
    expect(validarConteudo(com({ url: '' }), true, false)).toEqual({ ok: false, erro: expect.stringContaining('link') });
    expect(validarConteudo(com({ tipo: 'artigo', url: '', corpo: '   ' }), true, false)).toEqual({ ok: false, erro: expect.stringContaining('texto') });
    expect(validarConteudo(com({ tipo: 'artigo', url: '', corpo: 'Texto da aula.' }), true, false).ok).toBe(true);
    expect(validarConteudo(com({ tipo: 'material', url: '' }), true, false)).toEqual({ ok: false, erro: expect.stringContaining('arquivo') });
    expect(validarConteudo(com({ tipo: 'material', url: '' }), true, true).ok).toBe(true);
    expect(validarConteudo(com({ tipo: 'material', url: 'https://www.embrapa.br/cartilha.pdf' }), true, false).ok).toBe(true);
  });
});

describe('busca e filtros', () => {
  const lista = [
    { titulo: 'Adubação de cobertura no café', descricao: 'Parcelamento do nitrogênio', cultura: 'Café', fonte: 'Incaper', tipo: 'artigo', tema: 'adubacao', status: 'publicado' },
    { titulo: 'Calagem e gesso', descricao: null, cultura: 'Milho', fonte: null, tipo: 'video', tema: 'calagem', status: 'rascunho' },
    { titulo: 'Manejo da ferrugem', descricao: 'Doenças do cafeeiro', cultura: 'Café', fonte: 'Embrapa', tipo: 'material', tema: 'doencas', status: 'publicado' },
  ] as const;

  it('a busca ignora acento e caixa e exige todas as palavras', () => {
    expect(normalizarBusca('  Adubação   DE Café ')).toBe('adubacao de cafe');
    expect(filtrarConteudos(lista, { busca: 'adubacao cafe' })).toHaveLength(1);
    expect(filtrarConteudos(lista, { busca: 'cafeeiro' })).toHaveLength(1);
    expect(filtrarConteudos(lista, { busca: 'incaper' })).toHaveLength(1);
    expect(filtrarConteudos(lista, { busca: 'soja' })).toHaveLength(0);
  });

  it('filtra por tipo, tema, cultura e status, e combina', () => {
    expect(filtrarConteudos(lista, { tipo: 'video' }).map((c) => c.titulo)).toEqual(['Calagem e gesso']);
    expect(filtrarConteudos(lista, { tema: 'doencas' })).toHaveLength(1);
    expect(filtrarConteudos(lista, { cultura: 'cafe' })).toHaveLength(2);
    expect(filtrarConteudos(lista, { cultura: 'café', status: 'publicado' })).toHaveLength(2);
    expect(filtrarConteudos(lista, { cultura: 'café', tipo: 'material' })).toHaveLength(1);
    expect(filtrarConteudos(lista, {})).toHaveLength(3);
  });
});

describe('detalhes', () => {
  it('nome de arquivo seguro para o Storage', () => {
    expect(nomeSeguroDeArquivo('Cartilha de Solo (versão 2).pdf')).toBe('Cartilha-de-Solo-versao-2.pdf');
    expect(nomeSeguroDeArquivo('../../etc/passwd')).toBe('etc-passwd');
    expect(nomeSeguroDeArquivo('???')).toBe('arquivo');
  });
  it('domínio do link', () => {
    expect(dominioDoLink('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(dominioDoLink(null)).toBeNull();
  });
  it('situação da indicação', () => {
    expect(situacaoDaIndicacao({ aberto_em: null, concluido_em: null })).toBe('indicada');
    expect(situacaoDaIndicacao({ aberto_em: '2026-10-09', concluido_em: null })).toBe('aberta');
    expect(situacaoDaIndicacao({ aberto_em: '2026-10-09', concluido_em: '2026-10-10' })).toBe('concluida');
  });
});
