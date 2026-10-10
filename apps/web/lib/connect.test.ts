import { describe, expect, it } from 'vitest';
import {
  agruparPorStatus, diasParado, estaAtrasado, filtrarFila, linkWhatsApp, nomeSeguroDeAnexo, ordenarFila, resumirFila,
  descreverEvento, linkPedirAjuda, textoParaWhatsApp, validarMensagem, validarPedido, dataValida, type PedidoDaFila,
} from './connect';

const pedido = (o: Partial<PedidoDaFila> & { id: string; assunto?: string; produtor?: string }): PedidoDaFila & { assunto: string; produtor: string } => ({
  status: 'novo', prioridade: 'normal', responsavel_id: null, vencimento: null, ultima_interacao_em: '2026-10-01T10:00:00Z',
  criado_em: '2026-10-01T10:00:00Z', assunto: `Pedido ${o.id}`, produtor: 'José da Silva', ...o,
});

describe('validar o pedido', () => {
  const ok = { assunto: 'Folhas amareladas', descricao: '', categoria: 'problema_lavoura', urgente: false };
  it('pedido completo passa e vem normalizado', () => {
    expect(validarPedido({ ...ok, assunto: '  Folhas amareladas  ', descricao: '  Há uma semana  ', urgente: true })).toEqual({
      ok: true, dados: { assunto: 'Folhas amareladas', descricao: 'Há uma semana', categoria: 'problema_lavoura', prioridade: 'urgente' },
    });
    expect(validarPedido(ok)).toMatchObject({ ok: true, dados: { descricao: null, prioridade: 'normal' } });
  });
  it('explica o que falta', () => {
    expect(validarPedido({ ...ok, assunto: 'ab' })).toEqual({ ok: false, erro: expect.stringContaining('assunto') });
    expect(validarPedido({ ...ok, assunto: 'x'.repeat(161) })).toEqual({ ok: false, erro: expect.stringContaining('160') });
    expect(validarPedido({ ...ok, descricao: 'x'.repeat(4001) })).toEqual({ ok: false, erro: expect.stringContaining('4.000') });
    expect(validarPedido({ ...ok, categoria: 'astrologia' })).toEqual({ ok: false, erro: expect.stringContaining('tipo') });
  });
});

describe('validar a mensagem', () => {
  it('texto, ou foto sem texto (vira legenda), mas nunca vazio', () => {
    expect(validarMensagem('  Oi  ', false)).toEqual({ ok: true, corpo: 'Oi' });
    expect(validarMensagem('', true)).toEqual({ ok: true, corpo: '(foto)' });
    expect(validarMensagem('   ', false)).toEqual({ ok: false, erro: expect.stringContaining('Escreva') });
    expect(validarMensagem('x'.repeat(4001), false).ok).toBe(false);
  });
});

describe('prazo, atraso e parado', () => {
  it('atrasado = aberto com prazo vencido (o dia do prazo ainda não é atraso)', () => {
    expect(estaAtrasado({ status: 'novo', vencimento: '2026-10-05' }, '2026-10-06')).toBe(true);
    expect(estaAtrasado({ status: 'novo', vencimento: '2026-10-06' }, '2026-10-06')).toBe(false);
    expect(estaAtrasado({ status: 'resolvido', vencimento: '2026-10-01' }, '2026-10-06')).toBe(false);
    expect(estaAtrasado({ status: 'arquivado', vencimento: '2026-10-01' }, '2026-10-06')).toBe(false);
    expect(estaAtrasado({ status: 'novo', vencimento: null }, '2026-10-06')).toBe(false);
  });
  it('dias parado conta dias inteiros e nunca fica negativo', () => {
    expect(diasParado('2026-10-01T10:00:00Z', new Date('2026-10-04T09:00:00Z'))).toBe(2);
    expect(diasParado('2026-10-01T10:00:00Z', new Date('2026-10-01T11:00:00Z'))).toBe(0);
    expect(diasParado('2026-10-05T10:00:00Z', new Date('2026-10-01T10:00:00Z'))).toBe(0);
    expect(diasParado('lixo', new Date())).toBe(0);
  });
  it('data do prazo precisa ser de verdade', () => {
    expect(dataValida('2026-10-31')).toBe(true);
    for (const ruim of ['2026-02-31', '31/10/2026', '2026-13-01', '', 'amanhã']) expect(dataValida(ruim), ruim).toBe(false);
  });
});

describe('a fila', () => {
  const lista = [
    pedido({ id: 'a', prioridade: 'normal', criado_em: '2026-10-01T08:00:00Z' }),
    pedido({ id: 'b', prioridade: 'urgente', criado_em: '2026-10-03T08:00:00Z' }),
    pedido({ id: 'c', prioridade: 'alta', vencimento: '2026-10-04', criado_em: '2026-10-02T08:00:00Z' }),
    pedido({ id: 'd', prioridade: 'alta', vencimento: '2026-10-02', criado_em: '2026-10-02T09:00:00Z' }),
    pedido({ id: 'e', status: 'resolvido', responsavel_id: 'eu', criado_em: '2026-09-20T08:00:00Z' }),
    pedido({ id: 'f', status: 'em_acompanhamento', responsavel_id: 'eu', assunto: 'Adubação do café', produtor: 'Maria Souza' }),
  ];

  it('urgente primeiro, depois o que vence antes, depois o mais antigo', () => {
    const ordem = ordenarFila(lista).map((p) => p.id);
    expect(ordem.indexOf('b')).toBeLessThan(ordem.indexOf('d'));
    expect(ordem.indexOf('d')).toBeLessThan(ordem.indexOf('c'));
    expect(ordem.indexOf('c')).toBeLessThan(ordem.indexOf('a'));
  });

  it('agrupa por situação, já ordenado, sem perder ninguém', () => {
    const g = agruparPorStatus(lista);
    expect(g.novo.map((p) => p.id)[0]).toBe('b');
    expect(g.resolvido.map((p) => p.id)).toEqual(['e']);
    expect(g.em_acompanhamento.map((p) => p.id)).toEqual(['f']);
    expect(Object.values(g).flat()).toHaveLength(lista.length);
    expect(g.arquivado).toEqual([]);
  });

  it('filtra por responsável, prioridade, atraso e busca (sem acento)', () => {
    const hoje = '2026-10-06';
    expect(filtrarFila(lista, { quem: 'meus' }, 'eu', hoje).map((p) => p.id).sort()).toEqual(['e', 'f']);
    expect(filtrarFila(lista, { quem: 'sem_responsavel' }, 'eu', hoje).map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(filtrarFila(lista, { prioridade: 'urgente' }, 'eu', hoje).map((p) => p.id)).toEqual(['b']);
    expect(filtrarFila(lista, { atrasados: true }, 'eu', hoje).map((p) => p.id).sort()).toEqual(['c', 'd']);
    expect(filtrarFila(lista, { busca: 'adubacao maria' }, 'eu', hoje).map((p) => p.id)).toEqual(['f']);
    expect(filtrarFila(lista, {}, 'eu', hoje)).toHaveLength(6);
  });

  it('resume o que precisa de atenção (só o que está aberto)', () => {
    expect(resumirFila(lista, '2026-10-06')).toEqual({ abertos: 5, semResponsavel: 4, atrasados: 2, urgentes: 1, aguardandoProdutor: 0 });
  });
});

describe('WhatsApp', () => {
  it('monta o link com o número nos formatos que o cadastro guarda', () => {
    for (const tel of ['(27) 99912-3455', '27999123455', '+55 27 99912-3455', '5527999123455']) {
      expect(linkWhatsApp(tel, 'Olá'), tel).toBe('https://wa.me/5527999123455?text=Ol%C3%A1');
    }
    expect(linkWhatsApp('(27) 3722-1234', 'x')).toBe('https://wa.me/552737221234?text=x'); // fixo
  });
  it('sem número plausível não oferece o botão', () => {
    for (const ruim of [null, undefined, '', '123', '(27) 89912-3455', '99912-3455', 'não tem']) expect(linkWhatsApp(ruim, 'x'), String(ruim)).toBeNull();
  });
  it('o texto vai codificado e limitado', () => {
    const l = linkWhatsApp('27999123455', 'a&b=c "x" ' + 'z'.repeat(600))!;
    expect(l).not.toContain('&b=c');
    expect(decodeURIComponent(l.split('text=')[1]!).length).toBe(500);
  });
  it('texto pronto cita o pedido e o primeiro nome', () => {
    expect(textoParaWhatsApp('José da Silva', 'Folhas amareladas')).toBe('Olá, José! Sobre o seu pedido “Folhas amareladas” no AgroTech Connect: ');
    expect(textoParaWhatsApp(null, 'X')).toMatch(/^Olá! /);
  });
});

describe('histórico', () => {
  const nomes = new Map([['u1', 'Ana Souza']]);
  it('equipe vê tudo, com o nome do responsável', () => {
    expect(descreverEvento({ tipo: 'status', de: 'novo', para: 'em_triagem' }, 'equipe')).toBe('Situação: Em triagem');
    expect(descreverEvento({ tipo: 'responsavel', de: null, para: 'u1' }, 'equipe', nomes)).toBe('Responsável: Ana Souza');
    expect(descreverEvento({ tipo: 'responsavel', de: 'u1', para: null }, 'equipe', nomes)).toBe('Sem responsável');
    expect(descreverEvento({ tipo: 'prazo', de: null, para: '2026-10-20' }, 'equipe')).toBe('Prazo definido para 20/10/2026');
    expect(descreverEvento({ tipo: 'prioridade', de: 'normal', para: 'urgente' }, 'equipe')).toBe('Prioridade: urgente');
  });
  it('produtor vê a situação em linguagem dele e não vê responsável nem prioridade', () => {
    expect(descreverEvento({ tipo: 'status', de: 'novo', para: 'aguardando_produtor' }, 'produtor')).toBe('Situação: Precisamos de você');
    expect(descreverEvento({ tipo: 'prazo', de: null, para: '2026-10-20' }, 'produtor')).toBe('Prazo previsto: 20/10/2026');
    expect(descreverEvento({ tipo: 'responsavel', de: null, para: 'u1' }, 'produtor', nomes)).toBeNull();
    expect(descreverEvento({ tipo: 'prioridade', de: 'normal', para: 'alta' }, 'produtor')).toBeNull();
  });
});

describe('link para pedir ajuda', () => {
  const T = '63aaaaaa-0000-0000-0000-000000000001';
  it('leva assunto, tipo e talhão válidos', () => {
    expect(linkPedirAjuda({ assunto: 'Dúvida sobre o laudo', categoria: 'duvida', talhaoId: T }))
      .toBe(`/connect/pedidos/novo?categoria=duvida&assunto=D%C3%BAvida+sobre+o+laudo&talhao=${T}`);
  });
  it('marca o pedido que veio do Atlas', () => {
    expect(linkPedirAjuda({ assunto: 'Suspeita de ferrugem', origem: 'atlas' })).toBe('/connect/pedidos/novo?origem=atlas&assunto=Suspeita+de+ferrugem');
    expect(linkPedirAjuda({ origem: 'outra' as never })).toBe('/connect/pedidos/novo');
  });
  it('descarta o que não é seguro e corta o assunto em 160 letras', () => {
    expect(linkPedirAjuda({})).toBe('/connect/pedidos/novo');
    expect(linkPedirAjuda({ talhaoId: 'x" onmouseover=', categoria: 'astrologia' as never })).toBe('/connect/pedidos/novo');
    expect(decodeURIComponent(linkPedirAjuda({ assunto: 'a'.repeat(300) }).split('assunto=')[1]!).length).toBe(160);
  });
});

describe('nome de anexo', () => {
  it('sem acento, barra nem espaço, com a extensão', () => {
    expect(nomeSeguroDeAnexo('Foto da folha (1).JPG')).toBe('Foto-da-folha-1.JPG');
    expect(nomeSeguroDeAnexo('../../etc/passwd')).toBe('etc-passwd');
    expect(nomeSeguroDeAnexo('???')).toBe('arquivo');
  });
});
