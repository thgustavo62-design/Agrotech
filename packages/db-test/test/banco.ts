import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
const BOOTSTRAP = fileURLToPath(new URL('../bootstrap.sql', import.meta.url));

export interface FalhaMigration {
  arquivo: string;
  mensagem: string;
}

/** Postgres limpo com os stubs do Supabase (roles, auth, storage) e todas as migrations. */
export async function bancoMigrado(): Promise<{ db: PGlite; falhas: FalhaMigration[] }> {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(readFileSync(BOOTSTRAP, 'utf8'));
  const falhas: FalhaMigration[] = [];
  for (const arquivo of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(MIGRATIONS + arquivo, 'utf8'));
    } catch (e) {
      falhas.push({ arquivo, mensagem: (e as Error).message });
    }
  }
  return { db, falhas };
}

/** Executa `fn` como o usuário `uid`, com os claims que o hook de login injeta em produção. */
export async function como<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  const { rows } = await db.query<{ org_id: string | null; role: string }>(
    'select org_id, role from agro.profiles where id = $1',
    [uid],
  );
  const claims = JSON.stringify({ sub: uid, role: 'authenticated', org_id: rows[0]?.org_id, user_role: rows[0]?.role });
  await db.query("select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [claims, uid]);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

/** Código de erro do Postgres se a consulta falhar, ou null se passar. */
export async function codigoDeErro(db: PGlite, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'erro';
  }
}

export async function contar(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

export const ID = {
  consultorA: '11111111-1111-1111-1111-111111111111',
  produtorA: '22222222-2222-2222-2222-222222222222',
  consultorB: '33333333-3333-3333-3333-333333333333',
  produtorB: '44444444-4444-4444-4444-444444444444',
  /** segundo produtor da org A — para testar isolamento dentro do mesmo escritório */
  produtorA2: '55555555-5555-5555-5555-555555555555',
  orgA: 'aaaaaaaa-0000-0000-0000-000000000000',
  orgB: 'bbbbbbbb-0000-0000-0000-000000000000',
  cadA: 'a0000000-0000-0000-0000-000000000000',
  cadB: 'b0000000-0000-0000-0000-000000000000',
  cadA2: 'a0000000-0000-0000-0000-00000000000b',
  talhaoA: 'a2000000-0000-0000-0000-000000000000',
  talhaoB: 'b2000000-0000-0000-0000-000000000000',
  talhaoA2: 'a2000000-0000-0000-0000-00000000000b',
} as const;

/** 2 orgs; org A com consultor + 2 produtores (cada um com propriedade e talhão); org B com consultor + 1 produtor. */
export async function semear(db: PGlite): Promise<void> {
  const I = ID;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${I.consultorA}','ca@t'),('${I.produtorA}','pa@t'),('${I.consultorB}','cb@t'),('${I.produtorB}','pb@t'),('${I.produtorA2}','pa2@t');
    insert into agro.orgs (id, nome) values ('${I.orgA}','Org A'),('${I.orgB}','Org B');
    update agro.profiles set org_id='${I.orgA}', role='consultor' where id='${I.consultorA}';
    update agro.profiles set org_id='${I.orgA}', role='produtor'  where id in ('${I.produtorA}','${I.produtorA2}');
    update agro.profiles set org_id='${I.orgB}', role='consultor' where id='${I.consultorB}';
    update agro.profiles set org_id='${I.orgB}', role='produtor'  where id='${I.produtorB}';
    insert into agro.produtores (id, org_id, user_id, nome) values
      ('${I.cadA}','${I.orgA}','${I.produtorA}','Produtor A'),
      ('${I.cadA2}','${I.orgA}','${I.produtorA2}','Produtor A2'),
      ('${I.cadB}','${I.orgB}','${I.produtorB}','Produtor B');
    insert into agro.propriedades (id, produtor_id, nome) values
      ('a1000000-0000-0000-0000-000000000000','${I.cadA}','Prop A'),
      ('a1000000-0000-0000-0000-00000000000b','${I.cadA2}','Prop A2'),
      ('b1000000-0000-0000-0000-000000000000','${I.cadB}','Prop B');
    insert into agro.talhoes (id, propriedade_id, nome, cultura) values
      ('${I.talhaoA}','a1000000-0000-0000-0000-000000000000','T A','cafe-conilon'),
      ('${I.talhaoA2}','a1000000-0000-0000-0000-00000000000b','T A2','cafe-conilon'),
      ('${I.talhaoB}','b1000000-0000-0000-0000-000000000000','T B','cafe-conilon');
  `);
}
