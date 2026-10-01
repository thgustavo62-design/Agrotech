import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, contar, codigoDeErro, semear, ID } from './banco';

let db: PGlite;
const VISITA = 'a4000000-0000-0000-0000-000000000000';
const nomes = async (bucket: string) =>
  (await db.query<{ name: string }>('select name from storage.objects where bucket_id = $1 order by name', [bucket]))
    .rows.map((r) => r.name.split('/').slice(1).join('/'));

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  // visita com foto no talhão do produtor A2; arquivos de A e A2 nos três buckets
  await db.exec(`
    insert into agro.visitas (id, talhao_id, data) values ('${VISITA}','${ID.talhaoA2}','2026-09-30');
    insert into agro.visita_fotos (visita_id, storage_path) values ('${VISITA}','${ID.orgA}/${VISITA}/f.jpg');
    insert into storage.objects (bucket_id, name) values
      ('visitas','${ID.orgA}/${VISITA}/f.jpg'),
      ('recomendacoes','${ID.orgA}/${ID.cadA2}/laudo-do-A2.pdf'),
      ('recomendacoes','${ID.orgA}/${ID.cadA}/laudo-do-A.pdf'),
      ('laudos','${ID.orgA}/${ID.cadA2}/exame-do-A2.pdf'),
      ('laudos','${ID.orgA}/_/sem-produtor.pdf');
  `);
});

describe('Storage — leitura (0032): produtor só lê o que é dele', () => {
  it('produtor A não lê laudos, PDFs de recomendação nem fotos do outro produtor do mesmo escritório', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await nomes('recomendacoes')).toEqual([`${ID.cadA}/laudo-do-A.pdf`]);
      expect(await nomes('laudos')).toEqual([]);
      expect(await nomes('visitas')).toEqual([]);
    });
  });

  it('produtor A2 lê o próprio laudo, o próprio PDF e a foto da própria visita', async () => {
    await como(db, ID.produtorA2, async () => {
      expect(await nomes('recomendacoes')).toEqual([`${ID.cadA2}/laudo-do-A2.pdf`]);
      expect(await nomes('laudos')).toEqual([`${ID.cadA2}/exame-do-A2.pdf`]);
      expect(await nomes('visitas')).toEqual([`${VISITA}/f.jpg`]);
    });
  });

  it('consultor da org lê tudo da org; consultor de outra org não lê nada', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await nomes('recomendacoes')).toHaveLength(2);
      expect(await nomes('laudos')).toHaveLength(2); // inclui o enviado sem produtor ("_")
      expect(await nomes('visitas')).toHaveLength(1);
    });
    await como(db, ID.consultorB, async () => {
      expect(await contar(db, 'select count(*)::int n from storage.objects')).toBe(0);
    });
  });
});

describe('Portal do produtor — visitas (página Atividades)', () => {
  it('produtor lê visitas, ocorrências e fotos só do próprio talhão', async () => {
    await db.exec(`insert into agro.visita_ocorrencias (visita_id, alvo, valor, acima_nivel) values ('${VISITA}','lagarta','3 por planta',true)`);
    const conta = (t: string) => contar(db, `select count(*)::int n from agro.${t}`);
    await como(db, ID.produtorA2, async () => {
      expect([await conta('visitas'), await conta('visita_ocorrencias'), await conta('visita_fotos')]).toEqual([1, 1, 1]);
    });
    await como(db, ID.produtorA, async () => {
      expect([await conta('visitas'), await conta('visita_ocorrencias'), await conta('visita_fotos')]).toEqual([0, 0, 0]);
    });
  });
});

describe('Storage — envio de fotos de visita', () => {
  it('consultor sobe na pasta da própria org, mas não na de outra', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, "insert into storage.objects (bucket_id, name) values ('visitas', $1)", [`${ID.orgA}/${VISITA}/g.jpg`])).toBeNull();
      expect(await codigoDeErro(db, "insert into storage.objects (bucket_id, name) values ('visitas', $1)", [`${ID.orgB}/x/g.jpg`])).not.toBeNull();
    });
  });

  it('produtor não sobe foto de visita', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await codigoDeErro(db, "insert into storage.objects (bucket_id, name) values ('visitas', $1)", [`${ID.orgA}/${VISITA}/h.jpg`])).not.toBeNull();
    });
  });
});
