import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/** Avisos no celular (0052): cada pessoa vê e apaga só as próprias assinaturas; quem escreve é o servidor (chave de serviço). */
let db: PGlite;

const E = (n: number) => `https://push.exemplo.com/send/${n}`;
const tenta = (sql: string) => codigoDeErro(db, sql, []);

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  // semeia como dono (equivale à chave de serviço, que ignora a RLS)
  await db.exec(`
    insert into agro.push_assinaturas (user_id, org_id, endpoint, p256dh, auth) values
      ('${ID.produtorA}','${ID.orgA}','${E(1)}','p256dh-chave-longa-o-bastante-1','auth-chave-1'),
      ('${ID.consultorA}','${ID.orgA}','${E(2)}','p256dh-chave-longa-o-bastante-2','auth-chave-2'),
      ('${ID.produtorB}','${ID.orgB}','${E(3)}','p256dh-chave-longa-o-bastante-3','auth-chave-3');
  `);
});

describe('assinaturas de push', () => {
  it('cada pessoa vê só as próprias', async () => {
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ endpoint: string }>(`select endpoint from agro.push_assinaturas`);
      expect(rows.map((r) => r.endpoint)).toEqual([E(1)]);
    });
    await como(db, ID.consultorB, async () => expect(await contar(db, `select count(*) n from agro.push_assinaturas`)).toBe(0));
  });

  it('a pessoa apaga a própria e não a dos outros', async () => {
    await como(db, ID.produtorA, async () => {
      await db.query(`delete from agro.push_assinaturas where endpoint = '${E(2)}'`);
    });
    expect(await contar(db, `select count(*) n from agro.push_assinaturas where endpoint = '${E(2)}'`)).toBe(1);
    await como(db, ID.produtorA, async () => {
      await db.query(`delete from agro.push_assinaturas where endpoint = '${E(1)}'`);
    });
    expect(await contar(db, `select count(*) n from agro.push_assinaturas where endpoint = '${E(1)}'`)).toBe(0);
  });

  it('pelo cliente ninguém cria nem altera assinatura (só o servidor, com a chave de serviço)', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await tenta(`insert into agro.push_assinaturas (user_id, endpoint, p256dh, auth) values ('${ID.consultorA}','${E(9)}','p256dh-chave-longa-o-bastante-9','auth-chave-9')`)).toBe('42501');
      await db.query(`update agro.push_assinaturas set falhas = 99 where endpoint = '${E(2)}'`);
    });
    expect(await contar(db, `select count(*) n from agro.push_assinaturas where falhas = 99`)).toBe(0);
  });

  it('endereço só https e único; chaves com tamanho plausível', async () => {
    expect(await tenta(`insert into agro.push_assinaturas (user_id, endpoint, p256dh, auth) values ('${ID.produtorA}','http://inseguro.com/x','p256dh-chave-longa-o-bastante-9','auth-chave-9')`)).toBe('23514');
    expect(await tenta(`insert into agro.push_assinaturas (user_id, endpoint, p256dh, auth) values ('${ID.produtorA}','${E(3)}','p256dh-chave-longa-o-bastante-9','auth-chave-9')`)).toBe('23505');
    expect(await tenta(`insert into agro.push_assinaturas (user_id, endpoint, p256dh, auth) values ('${ID.produtorA}','${E(8)}','curta','auth-chave-9')`)).toBe('23514');
  });

  it('apagar a conta leva as assinaturas', async () => {
    await db.exec(`delete from agro.push_assinaturas where user_id = '${ID.produtorB}'`);
    await db.exec(`insert into agro.push_assinaturas (user_id, endpoint, p256dh, auth) values ('${ID.produtorB}','${E(7)}','p256dh-chave-longa-o-bastante-7','auth-chave-7')`);
    await db.exec(`delete from auth.users where id = '${ID.produtorB}'`);
    expect(await contar(db, `select count(*) n from agro.push_assinaturas where endpoint = '${E(7)}'`)).toBe(0);
  });
});

describe('marca de envio nas notificações', () => {
  it('a coluna existe e as notificações novas nascem sem marca', async () => {
    await db.exec(`insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo) values ('${ID.orgA}','${ID.produtorA2}','nova_analise','Teste de push')`);
    const { rows } = await db.query<{ push_enviado_em: string | null }>(`select push_enviado_em from agro.notificacoes where titulo = 'Teste de push'`);
    expect(rows[0]!.push_enviado_em).toBeNull();
  });
});
