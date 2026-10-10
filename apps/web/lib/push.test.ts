import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chaveParecidaComVapid, despacharPendentes, montarPayload, urlSegura, validarAssinatura, type Enviador, type PayloadPush } from './push';

describe('url do aviso', () => {
  it('só caminho relativo do próprio site', () => {
    expect(urlSegura('/connect/pedidos/abc')).toBe('/connect/pedidos/abc');
    expect(urlSegura('/academy/atlas/broca-do-cafe?indicado=1')).toBe('/academy/atlas/broca-do-cafe?indicado=1');
    for (const ruim of [null, undefined, '', 'https://mal.com/x', '//mal.com', '/\\mal.com', 'javascript:alert(1)', '/a\nb', `/${'x'.repeat(300)}`]) expect(urlSegura(ruim), String(ruim)).toBe('/');
  });
});

describe('payload do aviso', () => {
  it('título e resumo curtos, sem caracteres de controle, e o destino seguro', () => {
    const p = montarPayload({ id: 'n1', tipo: 'atendimento_resposta', titulo: `  O técnico respondeu:\n${'x'.repeat(200)}`, corpo: `Texto\tcom\ncontrole ${'y'.repeat(300)}`, link: '/connect/pedidos/1' });
    expect(p.titulo.length).toBeLessThanOrEqual(90);
    expect(p.titulo.endsWith('…')).toBe(true);
    expect(p.titulo).not.toMatch(/[\n\t]/);
    expect(p.corpo.length).toBeLessThanOrEqual(140);
    expect(p.url).toBe('/connect/pedidos/1');
    expect(p.tag).toBe('n-n1');
  });
  it('sem corpo e com link ruim ainda monta algo útil', () => {
    expect(montarPayload({ id: 'n2', tipo: 'x', titulo: '', corpo: null, link: 'http://mal.com' })).toEqual({ titulo: 'AgroTech', corpo: '', url: '/', tag: 'n-n2' });
  });
});

describe('assinatura do navegador', () => {
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
  it('aceita o que o navegador entrega', () => {
    expect(validarAssinatura(ok)).toEqual({ ok: true, assinatura: ok });
  });
  it('recusa endereço inseguro, chave curta ou com lixo', () => {
    expect(validarAssinatura({ ...ok, endpoint: 'http://x.com/a' }).ok).toBe(false);
    expect(validarAssinatura({ ...ok, endpoint: 'https://x.com/a b' }).ok).toBe(false);
    expect(validarAssinatura({ ...ok, p256dh: 'curta' }).ok).toBe(false);
    expect(validarAssinatura({ ...ok, auth: 'tem espaço!!' }).ok).toBe(false);
    expect(validarAssinatura({ endpoint: 1, p256dh: null, auth: undefined }).ok).toBe(false);
  });
  it('chave pública do servidor: 87 letras de base64 url', () => {
    expect(chaveParecidaComVapid(ok.p256dh)).toBe(true);
    expect(chaveParecidaComVapid('curta')).toBe(false);
    expect(chaveParecidaComVapid(null)).toBe(false);
  });
});

/** Banco falso mínimo: guarda notificações e assinaturas e entende as poucas consultas do despacho. */
function bancoFalso(notificacoes: Array<Record<string, unknown>>, assinaturas: Array<Record<string, unknown>>) {
  const tabelas: Record<string, Array<Record<string, unknown>>> = { notificacoes, push_assinaturas: assinaturas };
  const consulta = (tabela: string) => {
    const filtros: Array<(r: Record<string, unknown>) => boolean> = [];
    let ordem: string | null = null;
    let lim = Infinity;
    let acao: 'select' | 'update' | 'delete' = 'select';
    let mudanca: Record<string, unknown> = {};
    let devolver = false;
    const q = {
      select: () => { if (acao === 'update') devolver = true; return q; },
      update: (m: Record<string, unknown>) => { acao = 'update'; mudanca = m; return q; },
      delete: () => { acao = 'delete'; return q; },
      is: (c: string, v: null) => { filtros.push((r) => (r[c] ?? null) === v); return q; },
      lt: (c: string, v: string) => { filtros.push((r) => String(r[c]) < v); return q; },
      gte: (c: string, v: string) => { filtros.push((r) => String(r[c]) >= v); return q; },
      in: (c: string, v: unknown[]) => { filtros.push((r) => v.includes(r[c])); return q; },
      eq: (c: string, v: unknown) => { filtros.push((r) => r[c] === v); return q; },
      order: (c: string) => { ordem = c; return q; },
      limit: (n: number) => { lim = n; return q; },
      then: (ok: (v: { data: unknown }) => unknown) => {
        let alvo = tabelas[tabela]!.filter((r) => filtros.every((f) => f(r)));
        if (ordem) alvo = [...alvo].sort((a, b) => String(a[ordem!]).localeCompare(String(b[ordem!])));
        alvo = alvo.slice(0, lim);
        if (acao === 'update') for (const r of alvo) Object.assign(r, mudanca);
        if (acao === 'delete') tabelas[tabela] = tabelas[tabela]!.filter((r) => !alvo.includes(r));
        return Promise.resolve({ data: acao === 'select' || devolver ? alvo.map((r) => ({ ...r })) : null }).then(ok);
      },
    };
    return q;
  };
  const cliente = { schema: () => ({ from: (t: string) => consulta(t) }) } as unknown as SupabaseClient;
  return { cliente, tabelas };
}

describe('despacho dos avisos', () => {
  const agora = new Date('2026-10-10T12:00:00Z');
  const recente = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
  const n = (id: string, user: string, min: number, extra: Record<string, unknown> = {}) => ({ id, tipo: 'atendimento_resposta', titulo: `Aviso ${id}`, corpo: null, link: '/connect', destinatario_user_id: user, criado_em: recente(min), push_enviado_em: null, ...extra });
  const a = (id: string, user: string, falhas = 0) => ({ id, user_id: user, endpoint: `https://push.exemplo.com/${id}`, p256dh: 'x'.repeat(30), auth: 'y'.repeat(12), falhas });

  const enviadoPara: Array<{ endpoint: string; p: PayloadPush }> = [];
  const enviarSempre: Enviador = async (assin, p) => { enviadoPara.push({ endpoint: assin.endpoint, p }); return { ok: true }; };

  it('manda para os aparelhos de quem recebeu a notificação e marca como tratada', async () => {
    enviadoPara.length = 0;
    const { cliente, tabelas } = bancoFalso([n('n1', 'u1', 1), n('n2', 'u2', 2)], [a('a1', 'u1'), a('a2', 'u1'), a('a3', 'u3')]);
    const r = await despacharPendentes({ admin: cliente, enviar: enviarSempre, agora });
    expect(r).toMatchObject({ vistas: 2, reivindicadas: 2, enviados: 2, removidas: 0, falhas: 0 });
    expect(enviadoPara.map((e) => e.endpoint).sort()).toEqual(['https://push.exemplo.com/a1', 'https://push.exemplo.com/a2']);
    expect(enviadoPara[0]!.p).toMatchObject({ titulo: 'Aviso n1', url: '/connect' });
    expect(tabelas.notificacoes!.every((x) => x.push_enviado_em !== null)).toBe(true); // n2 não tinha aparelho: também fica tratada
  });

  it('não manda duas vezes (segunda rodada não acha nada)', async () => {
    enviadoPara.length = 0;
    const { cliente } = bancoFalso([n('n1', 'u1', 1)], [a('a1', 'u1')]);
    await despacharPendentes({ admin: cliente, enviar: enviarSempre, agora });
    const r2 = await despacharPendentes({ admin: cliente, enviar: enviarSempre, agora });
    expect(r2.vistas).toBe(0);
    expect(enviadoPara).toHaveLength(1);
  });

  it('notificação velha não vira aviso atrasado: só é dada como tratada', async () => {
    enviadoPara.length = 0;
    const { cliente, tabelas } = bancoFalso([n('velha', 'u1', 60)], [a('a1', 'u1')]);
    const r = await despacharPendentes({ admin: cliente, enviar: enviarSempre, agora });
    expect(r.vistas).toBe(0);
    expect(enviadoPara).toHaveLength(0);
    expect(tabelas.notificacoes![0]!.push_enviado_em).not.toBeNull();
  });

  it('assinatura que o serviço de push diz que não existe (404/410) é apagada', async () => {
    const { cliente, tabelas } = bancoFalso([n('n1', 'u1', 1)], [a('a1', 'u1'), a('a2', 'u1')]);
    const enviar: Enviador = async (assin) => (assin.endpoint.endsWith('a1') ? { ok: false, status: 410 } : { ok: true });
    const r = await despacharPendentes({ admin: cliente, enviar, agora });
    expect(r).toMatchObject({ enviados: 1, removidas: 1 });
    expect(tabelas.push_assinaturas!.map((x) => x.id)).toEqual(['a2']);
  });

  it('falha de rede conta; na quinta seguida a assinatura sai; sucesso zera', async () => {
    const { cliente, tabelas } = bancoFalso([n('n1', 'u1', 1), n('n2', 'u1', 1)], [a('a1', 'u1', 3), a('a2', 'u1', 4)]);
    const enviar: Enviador = async (assin) => (assin.endpoint.endsWith('a1') ? { ok: true } : { ok: false, status: 500 });
    const r = await despacharPendentes({ admin: cliente, enviar, agora });
    expect(r.falhas).toBeGreaterThan(0);
    expect(tabelas.push_assinaturas!.map((x) => x.id)).toEqual(['a1']);
    expect(tabelas.push_assinaturas![0]!.falhas).toBe(0);
  });

  it('respeita o limite por rodada', async () => {
    const { cliente } = bancoFalso(Array.from({ length: 5 }, (_, i) => n(`n${i}`, 'u1', 1)), [a('a1', 'u1')]);
    expect((await despacharPendentes({ admin: cliente, enviar: enviarSempre, agora, limite: 2 })).vistas).toBe(2);
  });
});
