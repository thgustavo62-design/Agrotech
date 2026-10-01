import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

let db: PGlite;

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`update agro.produtores set nome = 'Maria da Silva Sauro' where id = '${ID.cadA}'`);
});

/** Executa como `anon` (a chave pública do navegador, sem login). */
async function comoAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.exec('set role anon');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

describe('catálogo do schema agro', () => {
  it('toda tabela tem RLS ligada e pelo menos uma policy', async () => {
    const { rows } = await db.query<{ relname: string; rls: boolean; policies: number }>(`
      select c.relname, c.relrowsecurity as rls,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'agro' and c.relkind = 'r'`);
    expect(rows.filter((r) => !r.rls).map((r) => r.relname)).toEqual([]);
    expect(rows.filter((r) => r.policies === 0).map((r) => r.relname)).toEqual([]);
  });

  it('o role anon não tem grant em nenhuma tabela do schema agro', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      "select table_name from information_schema.role_table_grants where table_schema = 'agro' and grantee = 'anon'",
    );
    expect(rows).toEqual([]);
  });

  it('toda função SECURITY DEFINER fixa o search_path', async () => {
    const { rows } = await db.query<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agro' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it('a única superfície executável por anon são as três funções com token (0034)', async () => {
    const { rows } = await db.query<{ proname: string }>(`
      select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agro' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    expect(rows.map((r) => r.proname)).toEqual(['convite_equipe_resumo', 'convite_resumo', 'resultados_por_token']);
  });

  it('toda chave estrangeira simples tem índice na coluna filha (0036)', async () => {
    const { rows } = await db.query<{ coluna: string }>(`
      select c.conrelid::regclass::text || '.' || a.attname as coluna
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'agro'::regnamespace and array_length(c.conkey, 1) = 1
        and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
      order by 1`);
    expect(rows.map((r) => r.coluna)).toEqual([]);
  });

  it('o hook de login não é executável por authenticated', async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated', 'agro.custom_access_token_hook(jsonb)', 'execute') as ok",
    );
    expect(rows[0]!.ok).toBe(false);
  });
});

describe('casar_produtor — carteira do escritório', () => {
  const busca = `select * from agro.casar_produtor('${ID.orgA}', 'Maria da Silva')`;

  it('sem login não executa', async () => {
    await comoAnon(async () => expect(await codigoDeErro(db, busca)).toBe('42501'));
  });

  it('consultor de OUTRO escritório não recebe nada', async () => {
    await como(db, ID.consultorB, async () => {
      expect(await contar(db, `select count(*)::int n from agro.casar_produtor('${ID.orgA}', 'Maria da Silva')`)).toBe(0);
    });
  });

  it('produtor não usa (é ferramenta do consultor)', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await contar(db, `select count(*)::int n from agro.casar_produtor('${ID.orgA}', 'Maria da Silva')`)).toBe(0);
    });
  });

  it('consultor do próprio escritório encontra o produtor', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await contar(db, `select count(*)::int n from agro.casar_produtor('${ID.orgA}', 'Maria da Silva')`)).toBe(1);
    });
  });
});

describe('semear categorias financeiras', () => {
  it('sem login e de outro tenant são recusados e nada é gravado', async () => {
    await comoAnon(async () => {
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras('${ID.cadA}')`)).toBe('42501');
    });
    await como(db, ID.produtorA2, async () => {
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras('${ID.cadA}')`)).toBe('42501');
    });
    await como(db, ID.consultorB, async () => {
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras_escritorio('${ID.orgA}')`)).toBe('42501');
    });
    await como(db, ID.produtorA, async () => {
      // produtor não semeia as categorias do escritório, nem do próprio
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras_escritorio('${ID.orgA}')`)).toBe('42501');
    });
    expect(await contar(db, 'select count(*)::int n from agro.financeiro_categorias')).toBe(0);
    expect(await contar(db, 'select count(*)::int n from agro.financeiro_escrit_categorias')).toBe(0);
  });

  it('o dono semeia as próprias categorias, e só uma vez', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras('${ID.cadA}')`)).toBeNull();
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras('${ID.cadA}')`)).toBeNull();
    });
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, `select agro.semear_categorias_financeiras_escritorio('${ID.orgA}')`)).toBeNull();
    });
    expect(await contar(db, `select count(*)::int n from agro.financeiro_categorias where produtor_id = '${ID.cadA}'`)).toBe(16);
    expect(await contar(db, `select count(*)::int n from agro.financeiro_escrit_categorias where org_id = '${ID.orgA}'`)).toBe(12);
  });
});

describe('funções públicas por token', () => {
  it('anon consulta convite e resultados com token inexistente sem erro e sem dados', async () => {
    await comoAnon(async () => {
      expect(await codigoDeErro(db, "select * from agro.convite_resumo('00000000-0000-0000-0000-000000000000')")).toBeNull();
      expect(await codigoDeErro(db, "select agro.resultados_por_token('00000000-0000-0000-0000-000000000000')")).toBeNull();
    });
  });
  it('o link público devolve as tabelas calibradas do escritório dono (0035), e só dele', async () => {
    await db.exec(`
      insert into agro.tabelas_referencia (org_id, tipo, conteudo) values
        ('${ID.orgA}', 'fosforo', '[{"argila":"x","min":0,"q":[1,2,3,4]}]'),
        ('${ID.orgB}', 'fosforo', '[{"argila":"y","min":0,"q":[9,9,9,9]}]');
      insert into agro.compartilhamentos (id, org_id, produtor_id, token)
        values ('c0000000-0000-0000-0000-000000000001', '${ID.orgA}', '${ID.cadA}', 'cccccccc-0000-0000-0000-00000000aaaa');
    `);
    await comoAnon(async () => {
      const { rows } = await db.query<{ r: { tabelas: Record<string, unknown>; produtor: string } }>(
        "select agro.resultados_por_token('cccccccc-0000-0000-0000-00000000aaaa') as r",
      );
      expect(rows[0]!.r.tabelas).toEqual({ fosforo: [{ argila: 'x', min: 0, q: [1, 2, 3, 4] }] });
      expect(JSON.stringify(rows[0]!.r)).not.toContain('"y"'); // nada da org B
    });
  });

  it('anon não aceita convite (exige sessão)', async () => {
    await comoAnon(async () => {
      expect(await codigoDeErro(db, "select agro.aceitar_convite('00000000-0000-0000-0000-000000000000')")).toBe('42501');
    });
  });
});
