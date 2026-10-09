import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/**
 * Connect (0049): o produtor pede, a equipe atende. O banco garante: isolamento entre escritórios e produtores, nota interna
 * invisível ao produtor, responsável da equipe ativa, status que anda com a conversa, histórico, avisos, avaliação única.
 */
let db: PGlite;

const AGRO = '65111111-0000-0000-0000-000000000001'; // agronômico
const CAMPO = '65111111-0000-0000-0000-000000000002';
const LEITURA = '65111111-0000-0000-0000-000000000003';
const FIN = '65111111-0000-0000-0000-000000000004';
const DESAT = '65111111-0000-0000-0000-000000000005'; // agronômico removido
const dono = ID.consultorA; // proprietário
const PROP_A = 'a1000000-0000-0000-0000-000000000000'; // propriedade do produtor A (semear)
const PROP_A2 = 'a1000000-0000-0000-0000-00000000000b';

const tenta = (sql: string) => codigoDeErro(db, sql);
const RECUSA = ['22023', '42501', '23514'];
const recusado = (c: string | null) => expect(RECUSA).toContain(c);

async function criar(quem: string, produtor: string, campos = '', valores = ''): Promise<string> {
  await db.exec(`update agro.atendimentos set status = 'arquivado' where produtor_id = '${produtor}' and status not in ('resolvido', 'arquivado') and id not in (select id from agro.atendimentos where produtor_id = '${produtor}' order by criado_em desc limit 4)`);
  let id = '';
  await como(db, quem, async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into agro.atendimentos (produtor_id, ${campos.includes('assunto') ? '' : 'assunto, '}descricao ${campos}) values ('${produtor}', ${campos.includes('assunto') ? '' : "'Folhas amareladas no talhão 3', "}'Começou há uma semana' ${valores}) returning id`);
    id = rows[0]!.id;
  });
  return id;
}
const linha = async (id: string) => (await db.query<Record<string, unknown>>(`select * from agro.atendimentos where id = '${id}'`)).rows[0]!;
const estado = async (id: string) => String((await linha(id)).status);

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${AGRO}','ag@t'),('${CAMPO}','ca@t'),('${LEITURA}','le@t'),('${FIN}','fi@t'),('${DESAT}','de@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'], nome='Marta' where id='${AGRO}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo'], nome='Carlos' where id='${CAMPO}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['leitura'] where id='${LEITURA}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['financeiro'] where id='${FIN}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'], desativado_em=now() where id='${DESAT}';
  `);
});

describe('o produtor abre um pedido', () => {
  it('os campos que são da equipe voltam ao padrão (status, responsável, prazo, prioridade "alta")', async () => {
    const id = await criar(ID.produtorA, ID.cadA, ', status, responsavel_id, vencimento, prioridade, categoria',
      `, 'resolvido', '${AGRO}', '2026-12-01', 'alta', 'problema_lavoura'`);
    const l = await linha(id);
    expect(l).toMatchObject({ status: 'novo', responsavel_id: null, vencimento: null, prioridade: 'normal', origem: 'portal', categoria: 'problema_lavoura', org_id: ID.orgA, produtor_id: ID.cadA, criado_por: ID.produtorA });
  });

  it('urgente ele pode pedir; origem "atlas" também vale', async () => {
    const a = await criar(ID.produtorA, ID.cadA, ', prioridade', ", 'urgente'");
    const b = await criar(ID.produtorA, ID.cadA, ', origem', ", 'atlas'");
    expect((await linha(a)).prioridade).toBe('urgente');
    expect((await linha(b)).origem).toBe('atlas');
  });

  it('não abre pedido em nome de outro produtor, nem com propriedade ou talhão de outro', async () => {
    await como(db, ID.produtorA, async () => {
      recusado(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${ID.cadA2}', 'Em nome do vizinho')`));
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto, propriedade_id) values ('${ID.cadA}', 'Propriedade alheia', '${PROP_A2}')`)).toBe('22023');
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto, talhao_id) values ('${ID.cadA}', 'Talhão alheio', '${ID.talhaoA2}')`)).toBe('22023');
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto, propriedade_id, talhao_id) values ('${ID.cadA}', 'Os dele mesmo', '${PROP_A}', '${ID.talhaoA}')`)).toBeNull();
    });
  });

  it('assunto curto e categoria inexistente são recusados', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${ID.cadA}', 'ab')`)).toBe('23514');
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto, categoria) values ('${ID.cadA}', 'Assunto válido', 'astrologia')`)).toBe('23514');
    });
  });

  it('há um limite de 10 pedidos abertos por produtor (evita enxurrada); resolver libera', async () => {
    const U3 = '65111111-0000-0000-0000-0000000000a3';
    const CAD3 = '65cccccc-0000-0000-0000-0000000000a3';
    await db.exec(`
      insert into auth.users (id, email) values ('${U3}','a3@t');
      update agro.profiles set org_id = '${ID.orgA}', role = 'produtor' where id = '${U3}';
      insert into agro.produtores (id, org_id, user_id, nome) values ('${CAD3}','${ID.orgA}','${U3}','Produtor Três');`);
    await como(db, U3, async () => {
      for (let i = 1; i <= 10; i++) expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${CAD3}', 'Pedido ${i} em aberto')`), String(i)).toBeNull();
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${CAD3}', 'Pedido 11 em aberto')`)).toBe('22023');
    });
    await db.exec(`update agro.atendimentos set status = 'resolvido' where id = (select id from agro.atendimentos where produtor_id = '${CAD3}' limit 1)`);
    await como(db, U3, async () => {
      expect(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${CAD3}', 'Pedido depois de resolver um')`)).toBeNull();
    });
  });
});

describe('quem enxerga o quê', () => {
  let pedidoA = '';
  beforeAll(async () => {
    pedidoA = await criar(ID.produtorA, ID.cadA, ', categoria', ", 'duvida'");
  });

  it('o produtor vê só os dele; o outro produtor e o outro escritório não veem', async () => {
    await como(db, ID.produtorA, async () => expect(await contar(db, `select count(*) n from agro.atendimentos where id = '${pedidoA}'`)).toBe(1));
    await como(db, ID.produtorA2, async () => expect(await contar(db, `select count(*) n from agro.atendimentos where id = '${pedidoA}'`)).toBe(0));
    await como(db, ID.produtorB, async () => expect(await contar(db, `select count(*) n from agro.atendimentos`)).toBe(0));
    await como(db, ID.consultorB, async () => expect(await contar(db, `select count(*) n from agro.atendimentos`)).toBe(0));
  });

  it('toda a equipe do escritório lê (inclusive consulta e financeiro)', async () => {
    for (const quem of [dono, AGRO, CAMPO, LEITURA, FIN]) {
      await como(db, quem, async () => expect(await contar(db, `select count(*) n from agro.atendimentos where id = '${pedidoA}'`), quem).toBe(1));
    }
  });

  it('o produtor não muda o pedido (status, responsável, prazo)', async () => {
    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.atendimentos set status = 'resolvido', responsavel_id = '${AGRO}', vencimento = '2026-12-31' where id = '${pedidoA}'`);
    });
    expect(await linha(pedidoA)).toMatchObject({ status: 'novo', responsavel_id: null, vencimento: null });
  });

  it('agronômico, campo e proprietário atendem; consulta e financeiro não escrevem', async () => {
    for (const quem of [AGRO, CAMPO, dono]) {
      await como(db, quem, async () => { await db.query(`update agro.atendimentos set status = 'em_triagem' where id = '${pedidoA}'`); });
      expect(await estado(pedidoA), quem).toBe('em_triagem');
      await db.exec(`update agro.atendimentos set status = 'novo' where id = '${pedidoA}'`);
    }
    for (const quem of [LEITURA, FIN]) {
      await como(db, quem, async () => { await db.query(`update agro.atendimentos set status = 'resolvido' where id = '${pedidoA}'`); });
      expect(await estado(pedidoA), quem).toBe('novo');
      await como(db, quem, async () => recusado(await tenta(`insert into agro.atendimentos (produtor_id, assunto) values ('${ID.cadA}', 'Pedido da consulta')`)));
    }
  });

  it('o escritório B não mexe no pedido do A', async () => {
    await como(db, ID.consultorB, async () => { await db.query(`update agro.atendimentos set status = 'arquivado' where id = '${pedidoA}'`); });
    expect(await estado(pedidoA)).toBe('novo');
  });

  it('dados de identidade do pedido não mudam, nem pela equipe', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(`update agro.atendimentos set produtor_id = '${ID.cadA2}' where id = '${pedidoA}'`)).toBe('42501');
      expect(await tenta(`update agro.atendimentos set origem = 'atlas' where id = '${pedidoA}'`)).toBe('42501');
    });
  });
});

describe('responsável, prazo e histórico', () => {
  let id = '';
  beforeAll(async () => { id = await criar(ID.produtorA, ID.cadA); });

  it('o responsável tem de ser da equipe ATIVA do mesmo escritório', async () => {
    await como(db, dono, async () => {
      expect(await tenta(`update agro.atendimentos set responsavel_id = '${ID.produtorA}' where id = '${id}'`)).toBe('22023'); // produtor
      expect(await tenta(`update agro.atendimentos set responsavel_id = '${ID.consultorB}' where id = '${id}'`)).toBe('22023'); // outro escritório
      expect(await tenta(`update agro.atendimentos set responsavel_id = '${DESAT}' where id = '${id}'`)).toBe('22023'); // removido
      expect(await tenta(`update agro.atendimentos set responsavel_id = '${CAMPO}', vencimento = '2026-11-20', prioridade = 'alta' where id = '${id}'`)).toBeNull();
    });
    expect(await linha(id)).toMatchObject({ responsavel_id: CAMPO, prioridade: 'alta' });
  });

  it('cada mudança vira linha no histórico, com quem e quando', async () => {
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'em_triagem' where id = '${id}'`); });
    const { rows } = await db.query<{ tipo: string; de: string | null; para: string | null }>(`select tipo, de, para from agro.atendimento_eventos where atendimento_id = '${id}' order by criado_em, tipo`);
    const tipos = rows.map((r) => r.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['criado', 'responsavel', 'prazo', 'prioridade', 'status']));
    expect(rows.find((r) => r.tipo === 'status')).toMatchObject({ de: 'novo', para: 'em_triagem' });
  });

  it('o produtor vê no histórico o que é dele (criado, status, mensagem, prazo), não responsável nem prioridade', async () => {
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ tipo: string }>(`select distinct tipo from agro.atendimento_eventos where atendimento_id = '${id}'`);
      const tipos = rows.map((r) => r.tipo);
      expect(tipos).toEqual(expect.arrayContaining(['criado', 'status', 'prazo']));
      expect(tipos).not.toContain('responsavel');
      expect(tipos).not.toContain('prioridade');
    });
    await como(db, ID.produtorA2, async () => expect(await contar(db, `select count(*) n from agro.atendimento_eventos where atendimento_id = '${id}'`)).toBe(0));
  });

  it('ninguém escreve no histórico pela API', async () => {
    await como(db, dono, async () => {
      recusado(await tenta(`insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo) values ('${ID.orgA}','${id}','${ID.cadA}','status')`));
      await db.query(`delete from agro.atendimento_eventos where atendimento_id = '${id}'`);
    });
    expect(await contar(db, `select count(*) n from agro.atendimento_eventos where atendimento_id = '${id}'`)).toBeGreaterThan(0);
  });

  it('resolver grava a hora; reabrir apaga', async () => {
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'resolvido' where id = '${id}'`); });
    expect((await linha(id)).resolvido_em).not.toBeNull();
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'em_acompanhamento' where id = '${id}'`); });
    expect((await linha(id)).resolvido_em).toBeNull();
  });
});

describe('a conversa', () => {
  let id = '';
  beforeAll(async () => { id = await criar(ID.produtorA, ID.cadA); });
  const msg = (corpo: string, extra = '') => `insert into agro.atendimento_mensagens (atendimento_id, corpo ${extra ? ', ' + extra.split('=')[0] : ''}) values ('${id}', '${corpo}' ${extra ? ', ' + extra.split('=')[1] : ''})`;

  it('o produtor escreve; o banco decide autoria e tipo, e a nota "interna" dele vira mensagem normal', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.atendimento_mensagens (atendimento_id, corpo, autor_tipo, interna, autor_id) values ('${id}', 'Mando foto depois', 'equipe', true, '${AGRO}')`)).toBeNull();
    });
    const { rows } = await db.query<{ autor_tipo: string; interna: boolean; autor_id: string }>(`select autor_tipo, interna, autor_id from agro.atendimento_mensagens where atendimento_id = '${id}'`);
    expect(rows[0]).toEqual({ autor_tipo: 'produtor', interna: false, autor_id: ID.produtorA });
  });

  it('não escreve no pedido de outro produtor', async () => {
    await como(db, ID.produtorA2, async () => { recusado(await tenta(msg('Intrometido'))); });
    await como(db, ID.produtorB, async () => { recusado(await tenta(msg('Intrometido do B'))); });
  });

  it('a equipe com permissão responde; consulta e financeiro não', async () => {
    await como(db, AGRO, async () => expect(await tenta(msg('Pode mandar mais fotos?'))).toBeNull());
    for (const quem of [LEITURA, FIN]) await como(db, quem, async () => recusado(await tenta(msg('Sem permissão'))));
    await como(db, ID.consultorB, async () => recusado(await tenta(msg('Do outro escritório'))));
  });

  it('nota interna: só a equipe lê e escreve; o produtor não vê nem pela API', async () => {
    await como(db, AGRO, async () => expect(await tenta(msg('Suspeita de deficiência de boro', 'interna=true'))).toBeNull());
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ corpo: string }>(`select corpo from agro.atendimento_mensagens where atendimento_id = '${id}'`);
      expect(rows.map((r) => r.corpo)).toEqual(['Mando foto depois', 'Pode mandar mais fotos?']);
      expect(await contar(db, `select count(*) n from agro.atendimento_mensagens where interna`)).toBe(0);
    });
    await como(db, CAMPO, async () => expect(await contar(db, `select count(*) n from agro.atendimento_mensagens where atendimento_id = '${id}'`)).toBe(3));
  });

  it('o status anda com a conversa', async () => {
    const novo = await criar(ID.produtorA2, ID.cadA2, ', assunto', ", 'Pedido para a conversa'").catch(() => null);
    const p = novo ?? (await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Outro pedido'"));
    expect(await estado(p)).toBe('novo');
    // técnico responde (aberta ao produtor) → em acompanhamento
    await como(db, AGRO, async () => { await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo) values ('${p}', 'Recebi, vou olhar')`); });
    expect(await estado(p)).toBe('em_acompanhamento');
    // técnico pede informação → aguardando produtor; produtor responde → volta
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'aguardando_produtor' where id = '${p}'`); });
    const quem = (await linha(p)).produtor_id === ID.cadA ? ID.produtorA : ID.produtorA2;
    await como(db, quem, async () => { await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo) values ('${p}', 'Segue a informação')`); });
    expect(await estado(p)).toBe('em_acompanhamento');
    // nota interna não mexe no status
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'aguardando_produtor' where id = '${p}'`); await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo, interna) values ('${p}', 'só lembrete', true)`); });
    expect(await estado(p)).toBe('aguardando_produtor');
    // resolvido + produtor escreve → reabre
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'resolvido' where id = '${p}'`); });
    await como(db, quem, async () => { await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo) values ('${p}', 'Voltou o problema')`); });
    expect(await estado(p)).toBe('em_acompanhamento');
  });

  it('pedido arquivado não recebe mensagem do produtor', async () => {
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'arquivado' where id = '${id}'`); });
    await como(db, ID.produtorA, async () => expect(await tenta(msg('Depois de arquivado'))).toBe('22023'));
  });
});

describe('avisos', () => {
  it('pedido novo avisa proprietário e agronômico (não o campo); atribuir avisa o responsável', async () => {
    await db.exec(`delete from agro.notificacoes`);
    const id = await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Aviso de pedido novo'");
    const dest = (await db.query<{ destinatario_user_id: string; link: string; tipo: string }>(`select destinatario_user_id, link, tipo from agro.notificacoes where tipo = 'atendimento_novo'`)).rows;
    expect(dest.map((d) => d.destinatario_user_id).sort()).toEqual([dono, AGRO].sort());
    expect(dest[0]!.link).toBe(`/connect/atendimentos/${id}`);
    await como(db, dono, async () => { await db.query(`update agro.atendimentos set responsavel_id = '${CAMPO}' where id = '${id}'`); });
    const atr = (await db.query<{ destinatario_user_id: string }>(`select destinatario_user_id from agro.notificacoes where tipo = 'atendimento_atribuido'`)).rows;
    expect(atr.map((a) => a.destinatario_user_id)).toEqual([CAMPO]);
    // com responsável, o pedido novo avisa só ele
    await db.exec(`delete from agro.notificacoes`);
    await como(db, ID.produtorA, async () => { await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo) values ('${id}', 'Alguém aí?')`); });
    const resp = (await db.query<{ destinatario_user_id: string }>(`select destinatario_user_id from agro.notificacoes where tipo = 'atendimento_resposta'`)).rows;
    expect(resp.map((r) => r.destinatario_user_id)).toEqual([CAMPO]);
  });

  it('o produtor é avisado quando o técnico responde, pede algo ou resolve — com o link do pedido dele', async () => {
    await db.exec(`delete from agro.notificacoes`);
    const id = await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Aviso ao produtor'");
    await como(db, AGRO, async () => {
      await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo) values ('${id}', 'Olhei suas fotos')`);
      await db.query(`insert into agro.atendimento_mensagens (atendimento_id, corpo, interna) values ('${id}', 'anotação só nossa', true)`);
      await db.query(`update agro.atendimentos set status = 'aguardando_produtor' where id = '${id}'`);
      await db.query(`update agro.atendimentos set status = 'resolvido' where id = '${id}'`);
    });
    const n = (await db.query<{ tipo: string; titulo: string; link: string; destinatario_user_id: string }>(
      `select tipo, titulo, link, destinatario_user_id from agro.notificacoes where destinatario_user_id = '${ID.produtorA}' order by criado_em`)).rows;
    expect(n.map((x) => x.tipo)).toEqual(['atendimento_resposta', 'atendimento_status', 'atendimento_status']);
    expect(n.every((x) => x.link === `/connect/pedidos/${id}`)).toBe(true);
    expect(n.some((x) => /anotação/.test(x.titulo))).toBe(false); // nota interna não avisa ninguém
  });
});

describe('avaliar o atendimento', () => {
  let id = '';
  beforeAll(async () => { id = await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Para avaliar'"); });
  const avalia = (nota: number, quem: string, texto = 'null') => como(db, quem, () => tenta(`select agro.avaliar_atendimento('${id}', ${nota}, ${texto})`));

  it('só depois de resolvido, só o produtor do pedido, nota de 1 a 5, uma vez', async () => {
    expect(await avalia(5, ID.produtorA)).toBe('22023'); // ainda não resolvido
    await como(db, AGRO, async () => { await db.query(`update agro.atendimentos set status = 'resolvido' where id = '${id}'`); });
    expect(await avalia(5, ID.produtorA2)).toBe('42501'); // outro produtor
    expect(await avalia(5, AGRO)).toBe('42501'); // equipe não avalia pelo produtor
    expect(await avalia(0, ID.produtorA)).toBe('22023');
    expect(await avalia(6, ID.produtorA)).toBe('22023');
    expect(await avalia(4, ID.produtorA, "'Atendimento rápido'")).toBeNull();
    expect(await linha(id)).toMatchObject({ avaliacao: 4, avaliacao_comentario: 'Atendimento rápido' });
    expect(await avalia(1, ID.produtorA)).toBe('22023'); // só uma vez
  });

  it('o produtor não grava a nota direto na tabela', async () => {
    const outro = await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Nota forjada'");
    await como(db, ID.produtorA, async () => { await db.query(`update agro.atendimentos set avaliacao = 5, avaliado_em = now() where id = '${outro}'`); });
    expect((await linha(outro)).avaliacao).toBeNull();
  });
});

describe('arquivos (fotos do pedido)', () => {
  let id = '';
  let msgInterna = '';
  beforeAll(async () => {
    id = await criar(ID.produtorA, ID.cadA, ', assunto', ", 'Pedido com fotos'");
    await como(db, AGRO, async () => {
      const { rows } = await db.query<{ id: string }>(`insert into agro.atendimento_mensagens (atendimento_id, corpo, interna) values ('${id}', 'anotação com foto', true) returning id`);
      msgInterna = rows[0]!.id;
    });
  });
  const arq = (caminho: string, extra = '') => `insert into agro.atendimento_arquivos (atendimento_id, storage_path, nome, mime, bytes ${extra ? ', ' + extra.split('=')[0] : ''}) values ('${id}', '${caminho}', 'foto.jpg', 'image/jpeg', 1000 ${extra ? ', ' + extra.split('=')[1] : ''})`;

  it('o produtor anexa foto só dentro da pasta do pedido dele; tipo de arquivo é conferido', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(arq(`${ID.orgA}/${id}/a.jpg`))).toBeNull();
      expect(await tenta(arq(`${ID.orgA}/outro-pedido/b.jpg`))).toBe('22023');
      expect(await tenta(arq(`${ID.orgB}/${id}/c.jpg`))).toBe('22023');
      expect(await tenta(`insert into agro.atendimento_arquivos (atendimento_id, storage_path, nome, mime) values ('${id}', '${ID.orgA}/${id}/virus.exe', 'x.exe', 'application/x-msdownload')`)).toBe('23514');
    });
  });

  it('foto de nota interna: só a equipe vê', async () => {
    await como(db, AGRO, async () => { expect(await tenta(arq(`${ID.orgA}/${id}/interna.jpg`, `mensagem_id='${msgInterna}'`))).toBeNull(); });
    await como(db, ID.produtorA, async () => expect(await contar(db, `select count(*) n from agro.atendimento_arquivos where atendimento_id = '${id}'`)).toBe(1));
    await como(db, CAMPO, async () => expect(await contar(db, `select count(*) n from agro.atendimento_arquivos where atendimento_id = '${id}'`)).toBe(2));
    await como(db, ID.produtorA2, async () => expect(await contar(db, `select count(*) n from agro.atendimento_arquivos`)).toBe(0));
  });

  it('o produtor não consegue esconder foto como "interna" (o banco deriva isso da mensagem), nem anexar em pedido de outro', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(arq(`${ID.orgA}/${id}/forjada.jpg`, `interna=true`))).toBeNull(); // entra, mas como foto normal
    });
    const { rows } = await db.query<{ interna: boolean }>(`select interna from agro.atendimento_arquivos where storage_path = '${ID.orgA}/${id}/forjada.jpg'`);
    expect(rows[0]!.interna).toBe(false);
    await como(db, ID.produtorA2, async () => { recusado(await tenta(arq(`${ID.orgA}/${id}/intruso.jpg`))); });
  });

  it('Storage: o produtor envia só para a pasta do pedido dele e lê só o que a RLS deixa', async () => {
    await db.exec(`insert into storage.objects (bucket_id, name) values
      ('atendimentos','${ID.orgA}/${id}/a.jpg'), ('atendimentos','${ID.orgA}/${id}/interna.jpg'), ('atendimentos','${ID.orgB}/b/x.jpg')`);
    const nomes = async () => (await db.query<{ name: string }>(`select name from storage.objects where bucket_id = 'atendimentos' order by name`)).rows.map((r) => r.name);
    await como(db, ID.produtorA, async () => expect(await nomes()).toEqual([`${ID.orgA}/${id}/a.jpg`]));
    await como(db, CAMPO, async () => expect(await nomes()).toEqual([`${ID.orgA}/${id}/a.jpg`, `${ID.orgA}/${id}/interna.jpg`]));
    await como(db, ID.produtorA2, async () => expect(await nomes()).toEqual([]));
    await como(db, ID.consultorB, async () => expect(await nomes()).toEqual([`${ID.orgB}/b/x.jpg`]));
    const envia = (quem: string, caminho: string) => como(db, quem, () => tenta(`insert into storage.objects (bucket_id, name) values ('atendimentos','${caminho}')`));
    expect(await envia(ID.produtorA, `${ID.orgA}/${id}/nova.jpg`)).toBeNull();
    expect(await envia(ID.produtorA2, `${ID.orgA}/${id}/intruso.jpg`)).toBe('42501');
    expect(await envia(ID.produtorA, `${ID.orgA}/${randomId()}/dele.jpg`)).toBe('42501');
    expect(await envia(ID.produtorA, `${ID.orgB}/${id}/outro-escritorio.jpg`)).toBe('42501');
    expect(await envia(AGRO, `${ID.orgA}/${id}/da-equipe.jpg`)).toBeNull();
    expect(await envia(LEITURA, `${ID.orgA}/${id}/da-consulta.jpg`)).toBe('42501');
  });
});
const randomId = () => '65999999-0000-0000-0000-000000000009';

describe('LGPD: apagar o produtor leva pedidos, conversa e fotos', () => {
  it('as linhas do produtor somem; o resto do escritório fica', async () => {
    await criar(ID.produtorA2, ID.cadA2, ', assunto', ", 'Pedido do outro produtor'");
    expect(await contar(db, `select count(*) n from agro.atendimentos where produtor_id = '${ID.cadA}'`)).toBeGreaterThan(0);
    await db.exec(`delete from agro.produtores where id = '${ID.cadA}'`);
    for (const t of ['atendimentos', 'atendimento_mensagens', 'atendimento_arquivos', 'atendimento_eventos']) {
      expect(await contar(db, `select count(*) n from agro.${t} where produtor_id = '${ID.cadA}'`), t).toBe(0);
    }
    expect(await contar(db, `select count(*) n from agro.atendimentos where produtor_id = '${ID.cadA2}'`)).toBeGreaterThan(0);
  });
});
