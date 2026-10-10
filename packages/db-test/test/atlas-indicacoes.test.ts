import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/** Atlas — indicação de ficha a um produtor (0051): quem indica, quem vê, o que pode ser indicado e o aviso. */
let db: PGlite;

const U = {
  agro: '65111111-0000-0000-0000-000000000001',
  campo: '65111111-0000-0000-0000-000000000002',
  leitura: '65111111-0000-0000-0000-000000000003',
} as const;
const F = {
  publicada: '65aaaaaa-0000-0000-0000-000000000001',
  rascunho: '65aaaaaa-0000-0000-0000-000000000002',
  deB: '65bbbbbb-0000-0000-0000-000000000001',
} as const;
const VISITA_A2 = '65cccccc-0000-0000-0000-000000000001';

const tenta = (sql: string) => codigoDeErro(db, sql, []);
// o gatilho lê o produtor/ficha pela RLS de quem chama: do outro escritório ele nem enxerga (22023); com perfil errado é 42501
const recusado = (c: string | null) => expect(['22023', '42501']).toContain(c);
beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${U.agro}','ag@t'),('${U.campo}','ca@t'),('${U.leitura}','le@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${U.agro}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo']      where id='${U.campo}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['leitura']    where id='${U.leitura}';
    insert into agro.visitas (id, talhao_id, data) values ('${VISITA_A2}','${ID.talhaoA2}','2026-09-30');
    insert into agro.atlas_fichas (id, org_id, tipo, nome, partes, sobre) values
      ('${F.publicada}','${ID.orgA}','doenca','Ficha publicada', array['folha'], array['Texto.']),
      ('${F.rascunho}','${ID.orgA}','praga','Ficha rascunho', array['fruto'], array['Texto.']),
      ('${F.deB}','${ID.orgB}','doenca','Ficha do B', array['folha'], array['Texto.']);
    insert into agro.atlas_fotos (ficha_id, storage_path) values
      ('${F.publicada}','${ID.orgA}/atlas/${F.publicada}/a.jpg'),
      ('${F.deB}','${ID.orgB}/atlas/${F.deB}/b.jpg');
    update agro.atlas_fichas set status = 'publicado' where id in ('${F.publicada}','${F.deB}');
  `);
});

describe('quem indica (academy.indicar)', () => {
  it('agronômico, campo e proprietário indicam; consulta não', async () => {
    await como(db, U.agro, async () => expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','ferrugem-alaranjada','Ferrugem')`)).toBeNull());
    await como(db, U.campo, async () => expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','broca-do-cafe','Broca')`)).toBeNull());
    await como(db, ID.consultorA, async () => expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','bicho-mineiro','Bicho-mineiro')`)).toBeNull());
    await como(db, U.leitura, async () => expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','acaro-vermelho','Ácaro')`)).toBe('42501'));
  });

  it('o produtor não indica; o escritório B não indica para produtor do A', async () => {
    await como(db, ID.produtorA, async () => expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','roseliniose','Roseliniose')`)).toBe('42501'));
    await como(db, ID.consultorB, async () => recusado(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','fusariose','Fusariose')`)));
  });

  it('a mesma ficha não é indicada duas vezes ao mesmo produtor (mas a outro sim)', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA}','ferrugem-alaranjada','Ferrugem')`)).toBe('23505');
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA2}','ferrugem-alaranjada','Ferrugem')`)).toBeNull();
    });
  });
});

describe('o que pode ser indicado', () => {
  it('ficha do escritório só se publicada e do mesmo escritório; o título vem da ficha', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_id, titulo) values ('${ID.cadA}','${F.rascunho}','x x x')`)).toBe('22023');
      recusado(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_id, titulo) values ('${ID.cadA}','${F.deB}','x x x')`));
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_id, titulo) values ('${ID.cadA}','${F.publicada}','Título forjado')`)).toBeNull();
    });
    const { rows } = await db.query<{ titulo: string }>(`select titulo from agro.atlas_indicacoes where ficha_id = '${F.publicada}'`);
    expect(rows[0]!.titulo).toBe('Ficha publicada');
  });

  it('exatamente uma das duas: id ou slug; slug só no formato permitido', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, titulo) values ('${ID.cadA2}','Sem ficha')`)).toBe('23514');
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_id, ficha_slug, titulo) values ('${ID.cadA2}','${F.publicada}','x-y-z','As duas')`)).toBe('23514');
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA2}','../etc/passwd','Slug ruim')`)).toBe('23514');
    });
  });

  it('o contexto (visita) tem de ser do mesmo produtor', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo, visita_id) values ('${ID.cadA}','monitor-1','Monitor','${VISITA_A2}')`)).toBe('22023');
      expect(await tenta(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo, visita_id) values ('${ID.cadA2}','monitor-1','Monitor','${VISITA_A2}')`)).toBeNull();
    });
  });

  it('quem indicou é gravado pelo banco', async () => {
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo, indicado_por, aberto_em) values ('${ID.cadA2}','roseliniose','Roseliniose','${ID.consultorB}', now())`);
    });
    const { rows } = await db.query<{ indicado_por: string; aberto_em: string | null }>(`select indicado_por, aberto_em from agro.atlas_indicacoes where ficha_slug = 'roseliniose'`);
    expect(rows[0]).toEqual({ indicado_por: U.agro, aberto_em: null });
  });
});

describe('quem vê e o que o produtor pode fazer', () => {
  it('cada produtor vê só as próprias indicações; a equipe vê as do escritório; o outro escritório não vê nada', async () => {
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ produtor_id: string }>(`select produtor_id from agro.atlas_indicacoes`);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.produtor_id === ID.cadA)).toBe(true);
    });
    await como(db, ID.produtorB, async () => expect(await contar(db, `select count(*) n from agro.atlas_indicacoes`)).toBe(0));
    await como(db, ID.consultorB, async () => expect(await contar(db, `select count(*) n from agro.atlas_indicacoes`)).toBe(0));
    await como(db, U.leitura, async () => expect(await contar(db, `select count(*) n from agro.atlas_indicacoes`)).toBeGreaterThan(2));
  });

  it('o produtor marca a abertura uma vez; não muda mais nada nem a de outro', async () => {
    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.atlas_indicacoes set aberto_em = '2020-01-01' where ficha_slug = 'ferrugem-alaranjada'`);
      expect(await tenta(`update agro.atlas_indicacoes set mensagem = 'mudei' where ficha_slug = 'ferrugem-alaranjada'`)).toBe('42501');
      expect(await tenta(`update agro.atlas_indicacoes set titulo = 'Outro título' where ficha_slug = 'ferrugem-alaranjada'`)).toBe('42501');
    });
    const primeira = (await db.query<{ aberto_em: string }>(`select aberto_em from agro.atlas_indicacoes where ficha_slug = 'ferrugem-alaranjada' and produtor_id = '${ID.cadA}'`)).rows[0]!.aberto_em;
    expect(new Date(primeira).getFullYear()).toBeGreaterThan(2020); // a hora é do servidor
    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.atlas_indicacoes set aberto_em = '2021-01-01' where ficha_slug = 'ferrugem-alaranjada'`);
    });
    expect((await db.query<{ aberto_em: string }>(`select aberto_em from agro.atlas_indicacoes where ficha_slug = 'ferrugem-alaranjada' and produtor_id = '${ID.cadA}'`)).rows[0]!.aberto_em).toEqual(primeira);
    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.atlas_indicacoes set aberto_em = now() where produtor_id = '${ID.cadA2}'`);
    });
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where produtor_id = '${ID.cadA2}' and aberto_em is not null`)).toBe(0);
  });

  it('o produtor não apaga; a equipe com permissão apaga, consulta não', async () => {
    await como(db, ID.produtorA, async () => { await db.query(`delete from agro.atlas_indicacoes`); });
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where produtor_id = '${ID.cadA}'`)).toBeGreaterThan(0);
    await como(db, U.leitura, async () => { await db.query(`delete from agro.atlas_indicacoes where ficha_slug = 'broca-do-cafe'`); });
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where ficha_slug = 'broca-do-cafe'`)).toBe(1);
    await como(db, U.campo, async () => { await db.query(`delete from agro.atlas_indicacoes where ficha_slug = 'broca-do-cafe'`); });
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where ficha_slug = 'broca-do-cafe'`)).toBe(0);
  });

  it('apagar a ficha do escritório leva as indicações dela', async () => {
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where ficha_id = '${F.publicada}'`)).toBe(1);
    await db.exec(`delete from agro.atlas_fichas where id = '${F.publicada}'`);
    expect(await contar(db, `select count(*) n from agro.atlas_indicacoes where ficha_id = '${F.publicada}'`)).toBe(0);
  });
});

describe('aviso ao produtor', () => {
  it('quem já tem login recebe o aviso com o link da ficha; quem não tem, não', async () => {
    await db.exec(`update agro.produtores set user_id = null where id = '${ID.cadA2}'`);
    const antes = await contar(db, `select count(*) n from agro.notificacoes where tipo = 'conteudo_indicado' and link like '/academy/atlas/%'`);
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo, mensagem) values ('${ID.cadA}','cercosporiose','Cercosporiose','Veja antes da visita.')`);
      await db.query(`insert into agro.atlas_indicacoes (produtor_id, ficha_slug, titulo) values ('${ID.cadA2}','cercosporiose','Cercosporiose')`);
    });
    expect(await contar(db, `select count(*) n from agro.notificacoes where tipo = 'conteudo_indicado' and link like '/academy/atlas/%'`)).toBe(antes + 1);
    const { rows } = await db.query<{ titulo: string; corpo: string; link: string; destinatario_user_id: string }>(
      `select titulo, corpo, link, destinatario_user_id from agro.notificacoes where link = '/academy/atlas/cercosporiose'`);
    expect(rows[0]).toEqual({ titulo: 'Seu agrônomo indicou uma ficha do Atlas: Cercosporiose', corpo: 'Veja antes da visita.', link: '/academy/atlas/cercosporiose', destinatario_user_id: ID.produtorA });
  });
});
