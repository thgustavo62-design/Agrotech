import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enfileirar, listar, remover, sincronizar, paraFormData, ehErroDeRede, MAX_TENTATIVAS } from './fila-offline';

async function limpar() {
  for (const i of await listar()) await remover(i.id);
}

function formVisita(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('talhao_id', 't-1');
  fd.append('data', '2026-09-30');
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  fd.append('fotos', new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' }));
  fd.append('fotos', new File([], '', { type: 'application/octet-stream' })); // input de arquivo vazio
  return fd;
}

beforeEach(async () => {
  await limpar();
});

describe('fila offline', () => {
  it('guarda campos e foto, descarta arquivo vazio e gera a chave de idempotência', async () => {
    const item = await enfileirar(formVisita());
    const [salvo] = await listar();
    expect(salvo!.id).toBe(item.id);

    const fd = paraFormData(salvo!);
    expect(fd.get('talhao_id')).toBe('t-1');
    expect(String(fd.get('chave_cliente'))).toMatch(/^[0-9a-f-]{36}$/);
    const fotos = fd.getAll('fotos') as File[];
    expect(fotos).toHaveLength(1);
    expect(fotos[0]!.type).toBe('image/jpeg'); // o nome do arquivo não sobrevive ao clone no Node 20 (CI); o servidor não usa o nome
    expect(fotos[0]!.size).toBe(3);
  });

  it('mantém a chave que o form já trazia (o reenvio não gera outra)', async () => {
    await enfileirar(formVisita({ chave_cliente: 'abc' }));
    const [salvo] = await listar();
    expect(paraFormData(salvo!).getAll('chave_cliente')).toEqual(['abc']);
  });

  it('sincroniza em ordem e esvazia a fila', async () => {
    await enfileirar(formVisita({ obs: 'primeira' }));
    await enfileirar(formVisita({ obs: 'segunda' }));
    const enviar = vi.fn(async (_fd: FormData) => {});
    const r = await sincronizar(enviar);
    expect(r).toEqual({ enviadas: 2, recusadas: 0, parciais: 0, semRede: false });
    expect(enviar.mock.calls.map(([fd]) => fd.get('obs'))).toEqual(['primeira', 'segunda']);
    expect(await listar()).toHaveLength(0);
  });

  it('sem rede: para no primeiro item e o resto continua na fila', async () => {
    await enfileirar(formVisita({ obs: 'a' }));
    await enfileirar(formVisita({ obs: 'b' }));
    const enviar = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const r = await sincronizar(enviar);
    expect(r).toEqual({ enviadas: 0, recusadas: 0, parciais: 0, semRede: true });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(await listar()).toHaveLength(2);
  });

  it('erro do servidor marca o item com a mensagem e segue para o próximo', async () => {
    await enfileirar(formVisita({ obs: 'ruim' }));
    await enfileirar(formVisita({ obs: 'boa' }));
    const enviar = vi.fn(async (fd: FormData) => {
      if (fd.get('obs') === 'ruim') throw new Error('Talhão e data são obrigatórios.');
    });
    const r = await sincronizar(enviar);
    expect(r).toEqual({ enviadas: 1, recusadas: 1, parciais: 0, semRede: false });
    const restante = await listar();
    expect(restante).toHaveLength(1);
    expect(restante[0]!.erro).toBe('Talhão e data são obrigatórios.');
    expect(restante[0]!.tentativas).toBe(1);
  });
});

describe('ehErroDeRede', () => {
  it('TypeError (fetch falhou) é rede; Error do servidor não é', () => {
    expect(ehErroDeRede(new TypeError('Failed to fetch'))).toBe(true);
    expect(ehErroDeRede(new Error('boom'))).toBe(false);
  });
});

describe('sincronizar com ação que devolve resultado', () => {
  it('{ ok: false } é recusa do servidor: o item fica na fila com a mensagem', async () => {
    await enfileirar(formVisita({ obs: 'x' }));
    const enviar = vi.fn(async (_fd: FormData) => ({ ok: false, mensagem: 'Talhão e data são obrigatórios.' }));
    const r = await sincronizar(enviar);
    expect(r).toEqual({ enviadas: 0, recusadas: 1, parciais: 0, semRede: false });
    const [item] = await listar();
    expect(item!.erro).toBe('Talhão e data são obrigatórios.');
  });

  it('{ ok: true } remove o item (inclusive com aviso de foto)', async () => {
    await enfileirar(formVisita({ obs: 'y' }));
    const r = await sincronizar(async (_fd: FormData) => ({ ok: true, mensagem: 'Visita salva, mas 1 foto não foi enviada.' }));
    expect(r.enviadas).toBe(1);
    expect(await listar()).toHaveLength(0);
  });
});

describe('visita parcial (AG-007): gravou a visita mas faltou foto/ocorrência', () => {
  const parcial = { ok: true, parcial: true, mensagem: 'Visita salva, mas 1 item(ns) ainda não foram enviados.' };

  it('NÃO é sucesso: o item continua na fila, marcado como parcial, com a mesma chave', async () => {
    await enfileirar(formVisita({ obs: 'p' }));
    const [antes] = await listar();
    const chave = paraFormData(antes!).get('chave_cliente');

    const r = await sincronizar(async (_fd: FormData) => parcial);
    expect(r).toEqual({ enviadas: 0, recusadas: 0, parciais: 1, semRede: false });
    const [depois] = await listar();
    expect(depois).toMatchObject({ parcial: true, tentativas: 1, erro: parcial.mensagem });
    expect(paraFormData(depois!).get('chave_cliente')).toBe(chave); // reenviar usa a MESMA chave: completa, não duplica
    expect(paraFormData(depois!).getAll('fotos')).toHaveLength(1);   // e a foto continua guardada no aparelho
  });

  it('o reenvio seguinte completa e só então remove o item', async () => {
    await enfileirar(formVisita({ obs: 'q' }));
    const respostas = [parcial, { ok: true }];
    const enviar = vi.fn(async (_fd: FormData) => respostas.shift()!);
    await sincronizar(enviar);
    expect(await listar()).toHaveLength(1);
    const r = await sincronizar(enviar);
    expect(r.enviadas).toBe(1);
    expect(await listar()).toHaveLength(0);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('um item que nunca completa para de ser reenviado sozinho (sem laço), mas continua visível', async () => {
    await enfileirar(formVisita({ obs: 'r' }));
    const enviar = vi.fn(async (_fd: FormData) => parcial);
    for (let i = 0; i < MAX_TENTATIVAS + 3; i++) await sincronizar(enviar);
    expect(enviar).toHaveBeenCalledTimes(MAX_TENTATIVAS);
    const [item] = await listar();
    expect(item!.tentativas).toBe(MAX_TENTATIVAS);
    expect(item!.erro).toMatch(/Visita salva/);
  });

  it('um item parcial não trava os seguintes da fila', async () => {
    await enfileirar(formVisita({ obs: 'parcial' }));
    await enfileirar(formVisita({ obs: 'normal' }));
    const r = await sincronizar(async (fd: FormData) => (fd.get('obs') === 'parcial' ? parcial : { ok: true }));
    expect(r).toMatchObject({ enviadas: 1, parciais: 1 });
    expect((await listar()).map((i) => i.parcial)).toEqual([true]);
  });
});
