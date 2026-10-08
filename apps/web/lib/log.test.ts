import { describe, expect, it } from 'vitest';
import { limpar, montarLinha } from './log';

describe('limpar', () => {
  it('tira JWT, Bearer, chaves e senhas do texto', () => {
    const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4eHh4eHgifQ.assinaturaabc123';
    expect(limpar(`falhou com ${jwt} no cabeçalho`)).toBe('falhou com [omitido] no cabeçalho');
    expect(limpar('Authorization: Bearer abc.def.ghi')).not.toMatch(/abc\.def/);
    expect(limpar('erro {"password":"hunter2xx"}')).not.toMatch(/hunter2/);
    expect(limpar('senha=segredo123 e token: xyz987')).not.toMatch(/segredo123|xyz987/);
  });

  it('esconde o usuário do e-mail mas mantém o domínio (útil para diagnóstico)', () => {
    expect(limpar('convite para maria.souza@exemplo.com.br falhou')).toBe('convite para ***@exemplo.com.br falhou');
  });

  it('corta mensagens enormes', () => {
    expect(limpar('x'.repeat(5000)).length).toBe(600);
  });
});

describe('montarLinha', () => {
  it('uma linha JSON com hora, nível, contexto e o que ajuda a achar o resto', () => {
    const linha = montarLinha({ nivel: 'erro', contexto: 'acao.registrarVisita', mensagem: 'boom', codigo: '23505', requisicao: 'gru1::abc', extra: { talhao: 't1', fotos: 2 } }, new Date('2026-10-08T12:00:00Z'));
    expect(linha).not.toMatch(/\n/);
    expect(JSON.parse(linha)).toEqual({
      t: '2026-10-08T12:00:00.000Z', nivel: 'erro', contexto: 'acao.registrarVisita', mensagem: 'boom', codigo: '23505',
      requisicao: 'gru1::abc', extra: { talhao: 't1', fotos: 2 },
    });
  });
});
