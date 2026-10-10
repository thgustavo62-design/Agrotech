import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/**
 * Atlas do escritório (0050): fichas de doenças e pragas escritas pelo agrônomo, com fotos. O produtor só lê o que foi
 * PUBLICADO no próprio escritório; só quem tem academy.gerenciar escreve; publicar exige texto, parte da planta e foto.
 */
let db: PGlite;

const U = {
  agro: '63111111-0000-0000-0000-000000000001', // agronômico
  campo: '63111111-0000-0000-0000-000000000002',
  leitura: '63111111-0000-0000-0000-000000000003',
} as const;

const F = {
  publicada: '63aaaaaa-0000-0000-0000-000000000001',
  rascunho: '63aaaaaa-0000-0000-0000-000000000002',
  arquivada: '63aaaaaa-0000-0000-0000-000000000003',
  deB: '63bbbbbb-0000-0000-0000-000000000001',
  nova: '63cccccc-0000-0000-0000-000000000001',
} as const;

const caminho = (org: string, ficha: string, arq: string) => `${org}/atlas/${ficha}/${arq}`;
const tenta = (sql: string, params: unknown[] = []) => codigoDeErro(db, sql, params);
const nomes = async (sql: string) => (await db.query<{ nome: string }>(sql)).rows.map((r) => r.nome).sort();

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${U.agro}','ag@t'),('${U.campo}','ca@t'),('${U.leitura}','le@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${U.agro}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo']      where id='${U.campo}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['leitura']    where id='${U.leitura}';

    insert into agro.atlas_fichas (id, org_id, tipo, nome, partes, sobre, status) values
      ('${F.publicada}','${ID.orgA}','doenca','Ferrugem do escritório', array['folha'], array['Texto da ficha.'], 'rascunho'),
      ('${F.rascunho}','${ID.orgA}','praga','Praga em estudo', array['fruto'], array['Ainda em redação.'], 'rascunho'),
      ('${F.arquivada}','${ID.orgA}','praga','Praga antiga', array['ramo'], array['Texto antigo.'], 'rascunho'),
      ('${F.deB}','${ID.orgB}','doenca','Ficha do escritório B', array['folha'], array['Texto do B.'], 'rascunho');
    insert into agro.atlas_fotos (ficha_id, storage_path) values
      ('${F.publicada}','${caminho(ID.orgA, F.publicada, 'a.jpg')}'),
      ('${F.rascunho}','${caminho(ID.orgA, F.rascunho, 'r.jpg')}'),
      ('${F.arquivada}','${caminho(ID.orgA, F.arquivada, 'v.jpg')}'),
      ('${F.deB}','${caminho(ID.orgB, F.deB, 'b.jpg')}');
    update agro.atlas_fichas set status = 'publicado' where id = '${F.publicada}';
    update agro.atlas_fichas set status = 'publicado' where id = '${F.arquivada}';
    update agro.atlas_fichas set status = 'arquivado' where id = '${F.arquivada}';
    update agro.atlas_fichas set status = 'publicado' where id = '${F.deB}';
    insert into storage.objects (bucket_id, name) values
      ('academy','${caminho(ID.orgA, F.publicada, 'a.jpg')}'),
      ('academy','${caminho(ID.orgA, F.rascunho, 'r.jpg')}'),
      ('academy','${caminho(ID.orgA, F.arquivada, 'v.jpg')}'),
      ('academy','${caminho(ID.orgB, F.deB, 'b.jpg')}'),
      ('academy','${ID.orgA}/solto/qualquer.pdf');
  `);
});

describe('quem escreve fichas (permissão academy.gerenciar)', () => {
  const nova = (nome: string) => `insert into agro.atlas_fichas (org_id, tipo, nome) values ('${ID.orgA}','doenca','${nome}')`;

  it('agronômico e proprietário criam; campo e consulta não', async () => {
    await como(db, U.agro, async () => expect(await tenta(nova('Ficha do agrônomo'))).toBeNull());
    await como(db, ID.consultorA, async () => expect(await tenta(nova('Ficha do dono'))).toBeNull());
    await como(db, U.campo, async () => expect(await tenta(nova('Ficha do campo'))).toBe('42501'));
    await como(db, U.leitura, async () => expect(await tenta(nova('Ficha da consulta'))).toBe('42501'));
  });

  it('campo e consulta não editam nem apagam; o escritório B também não', async () => {
    for (const quem of [U.campo, U.leitura, ID.consultorB]) {
      await como(db, quem, async () => {
        await db.query(`update agro.atlas_fichas set nome = 'Alterada por engano' where id = '${F.publicada}'`);
        await db.query(`delete from agro.atlas_fichas where id = '${F.publicada}'`);
      });
    }
    expect(await contar(db, `select count(*) n from agro.atlas_fichas where id = '${F.publicada}' and nome = 'Ferrugem do escritório'`)).toBe(1);
    await como(db, ID.consultorB, async () => {
      expect(await tenta(nova('Invasão'))).toBe('42501');
    });
  });
});

describe('o produtor só lê ficha publicada do próprio escritório', () => {
  it('vê a publicada; não vê rascunho, arquivada nem a do outro escritório', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await nomes(`select nome from agro.atlas_fichas`)).toEqual(['Ferrugem do escritório']);
    });
    await como(db, ID.produtorA2, async () => {
      expect(await nomes(`select nome from agro.atlas_fichas`)).toEqual(['Ferrugem do escritório']);
    });
    await como(db, ID.produtorB, async () => {
      expect(await nomes(`select nome from agro.atlas_fichas`)).toEqual(['Ficha do escritório B']);
    });
  });

  it('as fotos seguem a ficha: só as da publicada', async () => {
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ storage_path: string }>(`select storage_path from agro.atlas_fotos`);
      expect(rows.map((r) => r.storage_path)).toEqual([caminho(ID.orgA, F.publicada, 'a.jpg')]);
    });
  });

  it('a equipe vê todas do escritório (rascunho e arquivada), e só as dele', async () => {
    await como(db, U.leitura, async () => {
      const n = await nomes(`select nome from agro.atlas_fichas`);
      expect(n).toContain('Praga em estudo');
      expect(n).toContain('Praga antiga');
      expect(n).not.toContain('Ficha do escritório B');
    });
  });

  it('o produtor nunca escreve', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.atlas_fichas (org_id, tipo, nome) values ('${ID.orgA}','doenca','Ficha do produtor')`)).toBe('42501');
      await db.query(`update agro.atlas_fichas set nome = 'Mexido' where id = '${F.publicada}'`);
      await db.query(`delete from agro.atlas_fotos`);
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fichas where nome = 'Mexido'`)).toBe(0);
    expect(await contar(db, `select count(*) n from agro.atlas_fotos`)).toBe(4);
  });
});

describe('o banco decide autoria e revisão', () => {
  it('autor é quem salvou; rascunho não ganha revisão forjada', async () => {
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.atlas_fichas (id, org_id, autor_id, tipo, nome) values ('${F.nova}','${ID.orgA}','${ID.consultorB}','doenca','Ficha de autoria')`);
      await db.query(`update agro.atlas_fichas set revisado_por = '${ID.consultorA}', revisado_em = '2020-01-01' where id = '${F.nova}'`);
    });
    const r = (await db.query<{ autor_id: string; revisado_por: string | null; revisado_em: string | null }>(`select autor_id, revisado_por, revisado_em from agro.atlas_fichas where id = '${F.nova}'`)).rows[0]!;
    expect(r).toEqual({ autor_id: U.agro, revisado_por: null, revisado_em: null });
  });

  it('publicar grava quem revisou e quando (o cliente não escolhe)', async () => {
    await como(db, U.agro, async () => {
      await db.query(`update agro.atlas_fichas set partes = array['folha'], sobre = array['O que é.'] where id = '${F.nova}'`);
      await db.query(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.nova}','${caminho(ID.orgA, F.nova, 'x.jpg')}')`);
      await db.query(`update agro.atlas_fichas set status = 'publicado', revisado_por = '${ID.consultorA}' where id = '${F.nova}'`);
    });
    const r = (await db.query<{ revisado_por: string; revisado_em: string | null; publicado_em: string | null }>(`select revisado_por, revisado_em, publicado_em from agro.atlas_fichas where id = '${F.nova}'`)).rows[0]!;
    expect(r.revisado_por).toBe(U.agro);
    expect(r.revisado_em).not.toBeNull();
    expect(r.publicado_em).not.toBeNull();
  });

  it('o escritório de uma ficha não muda', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`update agro.atlas_fichas set org_id = '${ID.orgB}' where id = '${F.nova}'`)).toBe('42501');
    });
  });
});

describe('publicar exige o que mostrar', () => {
  const tenta2 = (sql: string) => como(db, U.agro, () => tenta(sql));

  it('não nasce publicada (ainda não tem foto)', async () => {
    expect(await tenta2(`insert into agro.atlas_fichas (org_id, tipo, nome, partes, sobre, status) values ('${ID.orgA}','praga','Nasce publicada', array['fruto'], array['Texto.'], 'publicado')`)).toBe('22023');
  });

  it('sem foto não publica; com foto mas sem texto ou sem parte da planta também não', async () => {
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.atlas_fichas (id, org_id, tipo, nome, partes, sobre) values ('63dddddd-0000-0000-0000-000000000001','${ID.orgA}','praga','Sem foto', array['fruto'], array['Texto.'])`);
      expect(await tenta(`update agro.atlas_fichas set status = 'publicado' where id = '63dddddd-0000-0000-0000-000000000001'`)).toBe('22023');
      await db.query(`insert into agro.atlas_fichas (id, org_id, tipo, nome, partes) values ('63dddddd-0000-0000-0000-000000000002','${ID.orgA}','praga','Sem texto', array['fruto'])`);
      await db.query(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('63dddddd-0000-0000-0000-000000000002','${caminho(ID.orgA, '63dddddd-0000-0000-0000-000000000002', 'f.jpg')}')`);
      expect(await tenta(`update agro.atlas_fichas set status = 'publicado' where id = '63dddddd-0000-0000-0000-000000000002'`)).toBe('23514');
      await db.query(`insert into agro.atlas_fichas (id, org_id, tipo, nome, sobre) values ('63dddddd-0000-0000-0000-000000000003','${ID.orgA}','praga','Sem parte', array['Texto.'])`);
      await db.query(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('63dddddd-0000-0000-0000-000000000003','${caminho(ID.orgA, '63dddddd-0000-0000-0000-000000000003', 'f.jpg')}')`);
      expect(await tenta(`update agro.atlas_fichas set status = 'publicado' where id = '63dddddd-0000-0000-0000-000000000003'`)).toBe('23514');
    });
  });

  it('rascunho incompleto pode existir', async () => {
    expect(await tenta2(`insert into agro.atlas_fichas (org_id, tipo, nome) values ('${ID.orgA}','outro','Só o nome')`)).toBeNull();
  });
});

describe('limites do texto', () => {
  const tenta2 = (sql: string) => como(db, U.agro, () => tenta(sql));
  const base = (campos: string, valores: string) => `insert into agro.atlas_fichas (org_id, tipo, nome${campos}) values ('${ID.orgA}','doenca','Teste de limite'${valores})`;

  it('parte da planta e importância só aceitam os valores conhecidos', async () => {
    expect(await tenta2(base(', partes', `, array['folha','asa']`))).toBe('23514');
    expect(await tenta2(base(', importancia_campo', `, 'enorme'`))).toBe('23514');
    expect(await tenta2(base(', tipo_inexistente', `, 1`))).toBe('42703');
    expect(await tenta2(base(', partes, importancia_campo', `, array['raiz','colo'], 'extrema'`))).toBeNull();
  });

  it('listas: item vazio, item enorme e mais de 12 itens são recusados', async () => {
    expect(await tenta2(base(', manejo', `, array['bom','   ']`))).toBe('23514');
    expect(await tenta2(base(', manejo', `, array['${'x'.repeat(901)}']`))).toBe('23514');
    const treze = Array.from({ length: 13 }, (_, i) => `'item ${i}'`).join(',');
    expect(await tenta2(base(', favorecem', `, array[${treze}]`))).toBe('23514');
    expect(await tenta2(base(', manejo', `, array['${'x'.repeat(900)}']`))).toBeNull();
  });

  it('o link da fonte só aceita https', async () => {
    for (const url of ['http://exemplo.com/a', 'javascript:alert(1)', 'https://com espaço.com']) {
      expect(await tenta2(base(', url', `, '${url}'`)), url).toBe('23514');
    }
    expect(await tenta2(base(', url', `, 'https://www.embrapa.br/cafe'`))).toBeNull();
  });
});

describe('fotos', () => {
  it('têm de estar na pasta da própria ficha; o escritório vem da ficha, não do cliente', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.rascunho}','${caminho(ID.orgA, F.publicada, 'roubada.jpg')}')`)).toBe('22023');
      expect(await tenta(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.rascunho}','${caminho(ID.orgB, F.rascunho, 'b.jpg')}')`)).toBe('22023');
      expect(await tenta(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.rascunho}','${ID.orgA}/solto/x.jpg')`)).toBe('22023');
      await db.query(`insert into agro.atlas_fotos (ficha_id, org_id, storage_path) values ('${F.rascunho}','${ID.orgB}','${caminho(ID.orgA, F.rascunho, 'ok.jpg')}')`);
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where storage_path = '${caminho(ID.orgA, F.rascunho, 'ok.jpg')}' and org_id = '${ID.orgA}'`)).toBe(1);
  });

  it('no máximo 8 por ficha', async () => {
    await como(db, U.agro, async () => {
      for (let i = 0; i < 6; i++) await db.query(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.rascunho}','${caminho(ID.orgA, F.rascunho, `m${i}.jpg`)}')`);
      expect(await tenta(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.rascunho}','${caminho(ID.orgA, F.rascunho, 'nona.jpg')}')`)).toBe('22023');
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where ficha_id = '${F.rascunho}'`)).toBe(8);
  });

  it('a última foto de uma ficha publicada não sai; a ficha apagada leva as fotos junto', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`delete from agro.atlas_fotos where ficha_id = '${F.publicada}'`)).toBe('22023');
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where ficha_id = '${F.publicada}'`)).toBe(1);
    await como(db, U.agro, async () => {
      expect(await tenta(`update agro.atlas_fichas set status = 'rascunho' where id = '${F.nova}'`)).toBeNull();
      expect(await tenta(`delete from agro.atlas_fichas where id = '${F.nova}'`)).toBeNull();
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where ficha_id = '${F.nova}'`)).toBe(0);
  });

  it('apagar uma ficha PUBLICADA também leva as fotos (a proteção da última foto não trava a exclusão)', async () => {
    const id = '63eeeeee-0000-0000-0000-000000000001';
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.atlas_fichas (id, org_id, tipo, nome, partes, sobre) values ('${id}','${ID.orgA}','praga','Ficha para apagar', array['fruto'], array['Texto.'])`);
      await db.query(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${id}','${caminho(ID.orgA, id, 'z.jpg')}')`);
      await db.query(`update agro.atlas_fichas set status = 'publicado' where id = '${id}'`);
      expect(await tenta(`delete from agro.atlas_fichas where id = '${id}'`)).toBeNull();
    });
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where ficha_id = '${id}'`)).toBe(0);
    expect(await contar(db, `select count(*) n from agro.atlas_fichas where id = '${id}'`)).toBe(0);
  });

  it('campo e consulta não mexem nas fotos', async () => {
    for (const quem of [U.campo, U.leitura]) {
      await como(db, quem, async () => {
        expect(await tenta(`insert into agro.atlas_fotos (ficha_id, storage_path) values ('${F.arquivada}','${caminho(ID.orgA, F.arquivada, `${quem.slice(-1)}.jpg`)}')`)).toBe('42501');
        await db.query(`delete from agro.atlas_fotos where ficha_id = '${F.arquivada}'`);
      });
    }
    expect(await contar(db, `select count(*) n from agro.atlas_fotos where ficha_id = '${F.arquivada}'`)).toBe(1);
  });
});

describe('arquivos no Storage (bucket academy, pasta atlas)', () => {
  const lista = async () => (await db.query<{ name: string }>(`select name from storage.objects where bucket_id = 'academy' order by name`)).rows.map((r) => r.name);

  it('o produtor lê só a foto de ficha publicada do próprio escritório', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await lista()).toEqual([caminho(ID.orgA, F.publicada, 'a.jpg')]);
    });
    await como(db, ID.produtorB, async () => {
      expect(await lista()).toEqual([caminho(ID.orgB, F.deB, 'b.jpg')]);
    });
  });

  it('a equipe lê a pasta do escritório e nada do outro', async () => {
    await como(db, U.leitura, async () => {
      const l = await lista();
      expect(l).toContain(caminho(ID.orgA, F.rascunho, 'r.jpg'));
      expect(l).toContain(caminho(ID.orgA, F.arquivada, 'v.jpg'));
      expect(l.some((n) => n.startsWith(ID.orgB))).toBe(false);
    });
  });

  it('só quem tem academy.gerenciar envia foto; o produtor não envia', async () => {
    const envia = (quem: string) => como(db, quem, () => tenta(`insert into storage.objects (bucket_id, name) values ('academy','${caminho(ID.orgA, F.rascunho, `env-${quem.slice(-2)}.jpg`)}')`));
    expect(await envia(U.agro)).toBeNull();
    expect(await envia(U.campo)).toBe('42501');
    expect(await envia(ID.produtorA)).toBe('42501');
  });
});
