import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, codigoDeErro, semear, ID } from './banco';

let db: PGlite;

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
});

// talhão A: análise de 0-20 cm em ordem (antiga) e uma de 20-40 cm péssima (recente)
const A020 = 'a3000000-0000-0000-0000-000000000001';
const A2040 = 'a3000000-0000-0000-0000-000000000002';

describe('camada de coleta (0040): só 0–20 cm define a situação e o link do produtor', () => {
  beforeAll(async () => {
    await db.exec(`
      insert into agro.analises (id, talhao_id, data_coleta, profundidade, ph, ca, mg, k, al, h_al) values
        ('${A020}',  '${ID.talhaoA}', '2026-01-10', '0-20',  5.8, 3.0, 1.2, 80, 0,   3),
        ('${A2040}', '${ID.talhaoA}', '2026-06-10', '20-40', 4.2, 0.2, 0.1, 10, 1.8, 9);
      insert into agro.compartilhamentos (id, org_id, produtor_id, token)
        values ('c0000000-0000-0000-0000-0000000000f1', '${ID.orgA}', '${ID.cadA}', 'cccccccc-0000-0000-0000-00000000f001');
    `);
  });

  it('a view da situação ignora a amostra de 20–40 cm, mesmo sendo a mais recente', async () => {
    const { rows } = await db.query<{ analise_id: string; situacao: string }>(
      `select analise_id, situacao from agro.vw_talhao_situacao where talhao_id = '${ID.talhaoA}'`,
    );
    expect(rows[0]).toEqual({ analise_id: A020, situacao: 'em_ordem' });
  });

  it('só existe análise de 20–40 → o talhão fica "sem análise", não "precisa de correção"', async () => {
    await db.exec(`insert into agro.analises (id, talhao_id, data_coleta, profundidade, ph, ca, al) values
      ('a3000000-0000-0000-0000-000000000003', '${ID.talhaoB}', '2026-06-10', '20-40', 4.2, 0.2, 1.8)`);
    const { rows } = await db.query<{ situacao: string }>(`select situacao from agro.vw_talhao_situacao where talhao_id = '${ID.talhaoB}'`);
    expect(rows[0]!.situacao).toBe('sem_analise');
  });

  it('o link público do produtor não lista a amostra de 20–40 cm', async () => {
    await db.exec('set role anon');
    try {
      const { rows } = await db.query<{ r: { analises: Array<{ id: string; profundidade: string }> } }>(
        "select agro.resultados_por_token('cccccccc-0000-0000-0000-00000000f001') as r",
      );
      expect(rows[0]!.r.analises.map((a) => a.id)).toEqual([A020]);
    } finally {
      await db.exec('reset role');
    }
  });

  it('o banco recusa profundidade inventada em análise nova', async () => {
    expect(await codigoDeErro(db, `insert into agro.analises (talhao_id, data_coleta, profundidade) values ('${ID.talhaoA}', '2026-07-01', '10-30')`)).toBe('23514');
    expect(await codigoDeErro(db, `insert into agro.analises (talhao_id, data_coleta, profundidade) values ('${ID.talhaoA}', '2026-07-01', '0-40')`)).toBeNull();
  });
});
