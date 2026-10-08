import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, codigoDeErro, contar, semear, ID } from './banco';

/**
 * AG-007 — o reenvio de uma visita completa só o que faltou. O servidor faz `upsert ... ignoreDuplicates`
 * (INSERT ... ON CONFLICT (...) DO NOTHING); aqui se prova que as restrições da migration 0042 dão a esse
 * comando o comportamento esperado, inclusive depois de uma falha no meio.
 */

let db: PGlite;
const CHAVE = '9a000000-0000-4000-8000-0000000000aa';
let visitaId = '';

const ocorrencia = (indice: number, alvo: string) =>
  `insert into agro.visita_ocorrencias (visita_id, indice, alvo) values ('${visitaId}', ${indice}, '${alvo}') on conflict (visita_id, indice) do nothing`;
const foto = (chave: string) =>
  `insert into agro.visita_fotos (visita_id, chave, storage_path) values ('${visitaId}', '${chave}', '${ID.orgA}/${visitaId}/${chave}.jpg') on conflict (visita_id, chave) do nothing`;

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  const { rows } = await db.query<{ id: string }>(
    `insert into agro.visitas (talhao_id, data, chave_cliente) values ('${ID.talhaoA}', '2026-10-01', '${CHAVE}') returning id`,
  );
  visitaId = rows[0]!.id;
});

describe('reenvio de visita (0042)', () => {
  it('a visita com a mesma chave não duplica (0031) e dá para achá-la pela chave', async () => {
    expect(await codigoDeErro(db, `insert into agro.visitas (talhao_id, data, chave_cliente) values ('${ID.talhaoA}', '2026-10-01', '${CHAVE}')`)).toBe('23505');
    const { rows } = await db.query<{ id: string }>(`select id from agro.visitas where chave_cliente = '${CHAVE}'`);
    expect(rows.map((r) => r.id)).toEqual([visitaId]);
  });

  it('1ª tentativa parou no meio (só a ocorrência 1); o reenvio completa a 2 e a 3 sem duplicar a 1', async () => {
    await db.exec(ocorrencia(1, 'lagarta'));
    // reenvio com as três
    await db.exec(`${ocorrencia(1, 'lagarta')}; ${ocorrencia(2, 'ferrugem')}; ${ocorrencia(3, 'broca')};`);
    // e um segundo reenvio (resposta perdida de novo) não muda nada
    await db.exec(`${ocorrencia(1, 'lagarta')}; ${ocorrencia(2, 'ferrugem')}; ${ocorrencia(3, 'broca')};`);
    const { rows } = await db.query<{ indice: number; alvo: string }>(
      `select indice, alvo from agro.visita_ocorrencias where visita_id = '${visitaId}' order by indice`,
    );
    expect(rows).toEqual([{ indice: 1, alvo: 'lagarta' }, { indice: 2, alvo: 'ferrugem' }, { indice: 3, alvo: 'broca' }]);
  });

  it('fotos: cada uma tem chave própria; registrar de novo a mesma não duplica, outra foto entra', async () => {
    await db.exec(`${foto(`${CHAVE}-f0`)}; ${foto(`${CHAVE}-f0`)}; ${foto(`${CHAVE}-f1`)}; ${foto(`${CHAVE}-f1`)};`);
    expect(await contar(db, `select count(*)::int n from agro.visita_fotos where visita_id = '${visitaId}'`)).toBe(2);
  });

  it('linhas antigas (sem indice/chave) continuam valendo e não se conflitam entre si', async () => {
    await db.exec(`
      insert into agro.visita_ocorrencias (visita_id, alvo) values ('${visitaId}', 'antiga 1'), ('${visitaId}', 'antiga 2');
      insert into agro.visita_fotos (visita_id, storage_path) values ('${visitaId}', 'x/a.jpg'), ('${visitaId}', 'x/b.jpg');`);
    expect(await contar(db, `select count(*)::int n from agro.visita_ocorrencias where visita_id = '${visitaId}' and indice is null`)).toBe(2);
    expect(await contar(db, `select count(*)::int n from agro.visita_fotos where visita_id = '${visitaId}' and chave is null`)).toBe(2);
  });
});
