import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, codigoDeErro, contar, semear, ID } from './banco';

/**
 * AG-005 — com um TOKEN ANTIGO (claims de quando a pessoa ainda era da equipe), quem foi removido não lê nada.
 * `como()` do banco.ts monta os claims a partir do perfil ATUAL; aqui os claims são fixados à mão, como no mundo
 * real: o JWT sobrevive à remoção por até 1 hora.
 */

let db: PGlite;
const FUNC = '81111111-0000-0000-0000-000000000001';
const VISITA = 'a4000000-0000-0000-0000-0000000000a1';

async function comTokenAntigo<T>(uid: string, orgDoToken: string, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
    JSON.stringify({ sub: uid, role: 'authenticated', org_id: orgDoToken, user_role: 'consultor' }), uid,
  ]);
  await db.exec('set role authenticated');
  try { return await fn(); } finally { await db.exec('reset role'); }
}

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${FUNC}', 'func@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${FUNC}';
    insert into agro.visitas (id, talhao_id, data) values ('${VISITA}','${ID.talhaoA}','2026-09-30');
    insert into storage.objects (bucket_id, name) values ('visitas', '${ID.orgA}/${VISITA}/f.jpg');
  `);
});

describe('removido: o token antigo não lê mais nada (0041)', () => {
  it('antes da remoção: lê produtores, análises e arquivos do escritório', async () => {
    await comTokenAntigo(FUNC, ID.orgA, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.produtores')).toBeGreaterThan(0);
      expect(await contar(db, 'select count(*)::int n from agro.talhoes')).toBeGreaterThan(0);
      expect(await contar(db, 'select count(*)::int n from storage.objects')).toBeGreaterThan(0);
    });
  });

  it('depois (conta desativada, como o servidor faz): tabelas e arquivos vêm vazios com o MESMO token', async () => {
    await db.exec(`update agro.profiles set org_id = null, perfis = '{}', desativado_em = now() where id = '${FUNC}'`);
    await comTokenAntigo(FUNC, ID.orgA, async () => {
      for (const t of ['produtores', 'propriedades', 'talhoes', 'visitas']) {
        expect(await contar(db, `select count(*)::int n from agro.${t}`), t).toBe(0);
      }
      expect(await contar(db, 'select count(*)::int n from storage.objects')).toBe(0);
      expect(await contar(db, 'select count(*)::int n from agro.profiles where org_id is not null')).toBe(0); // nem a equipe
      expect(await codigoDeErro(db, `insert into agro.produtores (org_id, nome) values ('${ID.orgA}', 'x')`)).not.toBeNull();
    });
  });

  it('a pessoa removida ainda enxerga o PRÓPRIO perfil (a tela "seu acesso foi removido" precisa dele)', async () => {
    await comTokenAntigo(FUNC, ID.orgA, async () => {
      const { rows } = await db.query<{ desativado: boolean }>(`select desativado_em is not null as desativado from agro.profiles where id = '${FUNC}'`);
      expect(rows[0]).toEqual({ desativado: true });
    });
  });

  it('a equipe que ficou segue lendo normalmente (nada quebrou para os outros)', async () => {
    await comTokenAntigo(ID.consultorA, ID.orgA, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.produtores')).toBeGreaterThan(0);
    });
  });
});

describe('o escritório vem do perfil, não do token', () => {
  it('token ainda diz escritório A, mas a pessoa foi para B: lê B e nada de A', async () => {
    const MIGRADO = '81111111-0000-0000-0000-000000000002';
    await db.exec(`
      insert into auth.users (id, email) values ('${MIGRADO}', 'mig@t');
      update agro.profiles set org_id='${ID.orgB}', role='consultor', perfis=array['proprietario'] where id='${MIGRADO}';
    `);
    await comTokenAntigo(MIGRADO, ID.orgA, async () => {
      const { rows } = await db.query<{ nome: string }>('select nome from agro.produtores order by nome');
      expect(rows.map((r) => r.nome)).toEqual(['Produtor B']);
    });
  });

  it('produtor não é afetado (continua lendo o que é dele)', async () => {
    await db.query("select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
      JSON.stringify({ sub: ID.produtorA, role: 'authenticated', org_id: ID.orgA, user_role: 'produtor' }), ID.produtorA,
    ]);
    await db.exec('set role authenticated');
    try {
      expect(await contar(db, 'select count(*)::int n from agro.talhoes')).toBe(1);
    } finally { await db.exec('reset role'); }
  });
});
