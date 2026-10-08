import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, semear, ID } from './banco';

let db: PGlite;
const PROV = '91111111-0000-0000-0000-000000000001';

const perfil = async (id: string) =>
  (await db.query<{ senha_provisoria: boolean; mfa_ativo: boolean }>(`select senha_provisoria, mfa_ativo from agro.profiles where id = '${id}'`)).rows[0]!;

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email, encrypted_password) values ('${PROV}', 'prov@t', 'hash-antigo');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo'], senha_provisoria=true where id='${PROV}';
  `);
});

describe('senha provisória (0044)', () => {
  it('o cliente não consegue tirar a própria marca (nem pôr em outra pessoa)', async () => {
    await como(db, PROV, async () => {
      expect(await codigoDeErro(db, `update agro.profiles set senha_provisoria = false where id = '${PROV}'`)).toBe('42501');
    });
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, `update agro.profiles set senha_provisoria = false where id = '${PROV}'`)).toBe('42501'); // nem o proprietário libera a marca de outra pessoa
    });
    expect((await perfil(PROV)).senha_provisoria).toBe(true);
  });

  it('a marca sai sozinha quando a senha muda — e só quando muda', async () => {
    await db.exec(`update auth.users set email = 'prov2@t' where id = '${PROV}'`);       // outra coluna: continua
    expect((await perfil(PROV)).senha_provisoria).toBe(true);
    await db.exec(`update auth.users set encrypted_password = 'hash-novo' where id = '${PROV}'`);
    expect((await perfil(PROV)).senha_provisoria).toBe(false);
  });
});

describe('segundo fator (0044)', () => {
  it('o perfil reflete fator CONFIRMADO; não confirmado não conta; remover desliga', async () => {
    expect((await perfil(ID.consultorA)).mfa_ativo).toBe(false);
    const { rows } = await db.query<{ id: string }>(`insert into auth.mfa_factors (user_id, status) values ('${ID.consultorA}', 'unverified') returning id`);
    expect((await perfil(ID.consultorA)).mfa_ativo).toBe(false);
    await db.exec(`update auth.mfa_factors set status = 'verified' where id = '${rows[0]!.id}'`);
    expect((await perfil(ID.consultorA)).mfa_ativo).toBe(true);
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, `update agro.profiles set mfa_ativo = false where id = '${ID.consultorA}'`)).toBe('42501');
    });
    await db.exec(`delete from auth.mfa_factors where id = '${rows[0]!.id}'`);
    expect((await perfil(ID.consultorA)).mfa_ativo).toBe(false);
  });
});

describe('limite de usuários do plano, no banco (0044)', () => {
  const entra = (id: string) => `update agro.profiles set org_id = '${ID.orgB}', role = 'consultor' where id = '${id}'`;

  beforeAll(async () => {
    await db.exec(`
      insert into agro.planos (id, nome, lim_produtores, lim_talhoes, lim_laudos_mes, usuarios_max) values ('doisusers', 'Dois', 9, 9, 9, 2) on conflict (id) do update set usuarios_max = 2;
      insert into agro.assinaturas (org_id, plano, status) values ('${ID.orgB}', 'doisusers', 'ativa') on conflict (org_id) do update set plano = 'doisusers';
      insert into auth.users (id, email) values ('92222222-0000-0000-0000-000000000001','l1@t'),('92222222-0000-0000-0000-000000000002','l2@t'),('92222222-0000-0000-0000-000000000003','l3@t');
    `);
  });

  it('o escritório B (1 consultor) aceita mais um e recusa o terceiro, mesmo vindo do servidor', async () => {
    expect(await codigoDeErro(db, entra('92222222-0000-0000-0000-000000000001'))).toBeNull();
    expect(await codigoDeErro(db, entra('92222222-0000-0000-0000-000000000002'))).toBe('P0001');
  });

  it('conta desativada não ocupa vaga', async () => {
    await db.exec(`update agro.profiles set org_id = null, desativado_em = now() where id = '92222222-0000-0000-0000-000000000001'`);
    expect(await codigoDeErro(db, entra('92222222-0000-0000-0000-000000000003'))).toBeNull();
  });

  it('mexer em outra coluna do perfil de quem já está dentro não é bloqueado pelo limite', async () => {
    expect(await codigoDeErro(db, `update agro.profiles set titulo = 'Chefe' where id = '${ID.consultorB}'`)).toBeNull();
  });
});

describe('MFA aplicado no banco (0044): sessão só com senha (aal1) não lê nem grava', () => {
  const MFA = '93333333-0000-0000-0000-000000000001';

  async function comNivel<T>(uid: string, aal: 'aal1' | 'aal2', fn: () => Promise<T>): Promise<T> {
    await db.query("select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
      JSON.stringify({ sub: uid, role: 'authenticated', org_id: ID.orgA, user_role: 'consultor', aal }), uid,
    ]);
    await db.exec('set role authenticated');
    try { return await fn(); } finally { await db.exec('reset role'); }
  }
  const produtores = async () => (await db.query<{ n: number }>('select count(*)::int n from agro.produtores')).rows[0]!.n;

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id, email) values ('${MFA}', 'mfa@t');
      update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['proprietario'] where id='${MFA}';
      insert into auth.mfa_factors (user_id, status) values ('${MFA}', 'verified');
    `);
  });

  it('com o fator ligado, aal1 não vê nada e não grava; aal2 funciona normalmente', async () => {
    await comNivel(MFA, 'aal1', async () => {
      expect(await produtores()).toBe(0);
      expect(await codigoDeErro(db, `insert into agro.produtores (org_id, nome) values ('${ID.orgA}', 'por aal1')`)).not.toBeNull();
    });
    await comNivel(MFA, 'aal2', async () => {
      expect(await produtores()).toBeGreaterThan(0);
      expect(await codigoDeErro(db, `insert into agro.produtores (org_id, nome) values ('${ID.orgA}', 'por aal2')`)).toBeNull();
    });
  });

  it('o aal1 ainda enxerga o próprio perfil (é por ele que o app pede o código)', async () => {
    await comNivel(MFA, 'aal1', async () => {
      const { rows } = await db.query<{ mfa_ativo: boolean }>(`select mfa_ativo from agro.profiles where id = '${MFA}'`);
      expect(rows[0]).toEqual({ mfa_ativo: true });
    });
  });

  it('quem NÃO ligou o fator não é afetado por estar em aal1 (todos os outros testes seguem iguais)', async () => {
    await comNivel(ID.consultorA, 'aal1', async () => {
      expect(await produtores()).toBeGreaterThan(0);
    });
  });
});
