import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, semear, ID } from './banco';

/** Academy 0047: notícias (resumo próprio + fonte + link) e visibilidade por cultura. */
let db: PGlite;

const AGRO = '63111111-0000-0000-0000-000000000001';
const PROD_MILHO = '63111111-0000-0000-0000-000000000002';
const CAD_MILHO = '63cccccc-0000-0000-0000-000000000001';
const C = {
  cafe: '63aaaaaa-0000-0000-0000-000000000001',
  milho: '63aaaaaa-0000-0000-0000-000000000002',
  cafeB: '63aaaaaa-0000-0000-0000-000000000003',
} as const;

const tenta = (sql: string) => codigoDeErro(db, sql);
const ids = async (sql: string) => (await db.query<{ id: string }>(sql)).rows.map((r) => r.id).sort();

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${AGRO}','ag@t'),('${PROD_MILHO}','pm@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${AGRO}';
    update agro.profiles set org_id='${ID.orgA}', role='produtor' where id='${PROD_MILHO}';
    insert into agro.produtores (id, org_id, user_id, nome) values ('${CAD_MILHO}','${ID.orgA}','${PROD_MILHO}','Produtor Milho');
    insert into agro.propriedades (id, produtor_id, nome) values ('63dddddd-0000-0000-0000-000000000001','${CAD_MILHO}','Prop Milho');
    insert into agro.talhoes (id, propriedade_id, nome, cultura) values ('63eeeeee-0000-0000-0000-000000000001','63dddddd-0000-0000-0000-000000000001','T Milho','milho');
    insert into agro.academy_conteudos (id, org_id, tipo, titulo, url, cultura, status, visibilidade) values
      ('${C.cafe}','${ID.orgA}','video','Poda do café','https://youtu.be/a','Café','publicado','cultura'),
      ('${C.milho}','${ID.orgA}','video','Plantio do milho','https://youtu.be/b','MILHO','publicado','cultura'),
      ('${C.cafeB}','${ID.orgB}','video','Café do escritório B','https://youtu.be/c','Café','publicado','cultura');
  `);
});

describe('chave da cultura', () => {
  it('"Café", "MILHO" e variações viram a mesma chave', async () => {
    const { rows } = await db.query<{ a: string; b: string; c: string | null; d: string }>(
      `select agro.slug_cultura('Café') a, agro.slug_cultura('  CAFÉ-Arábica ') b, agro.slug_cultura('   ') c, agro.slug_cultura('Pimenta do Reino') d`);
    expect(rows[0]).toEqual({ a: 'cafe', b: 'cafe-arabica', c: null, d: 'pimenta-do-reino' });
  });

  it('o banco mantém a chave sozinho, mesmo que o cliente mande outra', async () => {
    await como(db, AGRO, async () => {
      await db.query(`update agro.academy_conteudos set cultura_chave = 'forjada', cultura = 'Soja' where id = '${C.milho}'`);
    });
    const { rows } = await db.query<{ cultura_chave: string }>(`select cultura_chave from agro.academy_conteudos where id = '${C.milho}'`);
    expect(rows[0]!.cultura_chave).toBe('soja');
    await db.exec(`update agro.academy_conteudos set cultura = 'MILHO' where id = '${C.milho}'`);
  });
});

describe('visibilidade por cultura', () => {
  it('quem tem talhão de café (conilon) vê o conteúdo de "Café"; quem só tem milho não', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.cafe]);
    });
    await como(db, PROD_MILHO, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.milho]);
    });
  });

  it('não vaza para outro escritório', async () => {
    await como(db, ID.produtorB, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.cafeB]);
    });
    await como(db, ID.consultorB, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.cafeB]);
    });
  });

  it('o produtor passa a ver quando ganha um talhão daquela cultura (calculado na leitura)', async () => {
    await db.exec(`insert into agro.talhoes (id, propriedade_id, nome, cultura) values ('63eeeeee-0000-0000-0000-000000000002','63dddddd-0000-0000-0000-000000000001','T Café','cafe-arabica')`);
    await como(db, PROD_MILHO, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.cafe, C.milho].sort());
    });
  });

  it('uma cultura que só começa com as mesmas letras não casa ("caf" não é café)', async () => {
    await db.exec(`insert into agro.academy_conteudos (id, org_id, tipo, titulo, url, cultura, status, visibilidade) values ('63aaaaaa-0000-0000-0000-000000000009','${ID.orgA}','video','Cultura caf','https://youtu.be/z','caf','publicado','cultura')`);
    await como(db, ID.produtorA, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id = '63aaaaaa-0000-0000-0000-000000000009'`)).toEqual([]);
    });
  });

  it('"por cultura" exige a cultura', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(`insert into agro.academy_conteudos (org_id, tipo, titulo, url, visibilidade) values ('${ID.orgA}','video','Sem cultura','https://youtu.be/q','cultura')`)).toBe('23514');
      expect(await tenta(`insert into agro.academy_conteudos (org_id, tipo, titulo, url, cultura, visibilidade) values ('${ID.orgA}','video','Com cultura','https://youtu.be/q','Soja','cultura')`)).toBeNull();
    });
  });

  it('rascunho por cultura continua invisível ao produtor', async () => {
    await db.exec(`insert into agro.academy_conteudos (id, org_id, tipo, titulo, cultura, status, visibilidade) values ('63aaaaaa-0000-0000-0000-000000000008','${ID.orgA}','video','Rascunho café','Café','rascunho','cultura')`);
    await como(db, ID.produtorA, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id = '63aaaaaa-0000-0000-0000-000000000008'`)).toEqual([]);
    });
  });
});

describe('notícias do agro', () => {
  const noticia = (campos: string, valores: string, status = 'publicado') =>
    `insert into agro.academy_conteudos (org_id, tipo, titulo, status ${campos}) values ('${ID.orgA}','noticia','Chuva volta ao Norte do ES','${status}' ${valores})`;

  it('só publica com resumo próprio, fonte e link', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(noticia(', url, fonte', ", 'https://exemplo.com/m', 'Incaper'"))).toBe('23514'); // sem resumo
      expect(await tenta(noticia(', url, descricao', ", 'https://exemplo.com/m', 'Chuva volta...'"))).toBe('23514'); // sem fonte
      expect(await tenta(noticia(', descricao, fonte', ", 'Resumo do escritório', 'Incaper'"))).toBe('23514'); // sem link
      expect(await tenta(noticia(', url, descricao, fonte', ", 'https://exemplo.com/m', 'Resumo do escritório', 'Incaper'"))).toBeNull();
    });
  });

  it('rascunho de notícia pode estar incompleto, e o link continua só https', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(noticia('', '', 'rascunho'))).toBeNull();
      expect(await tenta(noticia(', url', ", 'http://exemplo.com/m'", 'rascunho'))).toBe('23514');
    });
  });

  it('guarda a data da matéria e a região', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(noticia(', url, descricao, fonte, data_materia, regiao', ", 'https://exemplo.com/n', 'Resumo', 'Embrapa', '2026-10-01', 'Norte do ES'"))).toBeNull();
      expect(await tenta(noticia(', regiao', `, '${'x'.repeat(81)}'`, 'rascunho'))).toBe('23514');
    });
  });

  it('o produtor lê a notícia publicada para todos do escritório', async () => {
    await como(db, ID.produtorA2, async () => {
      const { rows } = await db.query<{ n: number }>(`select count(*) n from agro.academy_conteudos where tipo = 'noticia'`);
      expect(Number(rows[0]!.n)).toBeGreaterThanOrEqual(1);
    });
  });
});
