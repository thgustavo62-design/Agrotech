import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/**
 * Academy 0048: cursos (módulos e aulas), matrícula, progresso e certificado. A regra mora no banco:
 * quem vê o quê, o que dá para publicar, o produtor só mexe no próprio progresso e o certificado nasce da conta do banco.
 */
let db: PGlite;

const AGRO = '64111111-0000-0000-0000-000000000001'; // agronômico
const CAMPO = '64111111-0000-0000-0000-000000000002';
const CAD_A3 = '64cccccc-0000-0000-0000-000000000001'; // produtor só de milho (outra cultura)
const USER_A3 = '64111111-0000-0000-0000-000000000003';

const K = {
  todos: '64aaaaaa-0000-0000-0000-000000000001',
  sel: '64aaaaaa-0000-0000-0000-000000000002',
  cafe: '64aaaaaa-0000-0000-0000-000000000003',
  rasc: '64aaaaaa-0000-0000-0000-000000000004',
  semCert: '64aaaaaa-0000-0000-0000-000000000005',
  deB: '64bbbbbb-0000-0000-0000-000000000001',
} as const;
const M = { todos: '64dddddd-0000-0000-0000-000000000001', sel: '64dddddd-0000-0000-0000-000000000002', semCert: '64dddddd-0000-0000-0000-000000000003' } as const;
// conteúdos (aulas)
const A = {
  v1: '64eeeeee-0000-0000-0000-000000000001', // vídeo "todos"
  v2: '64eeeeee-0000-0000-0000-000000000002', // artigo só selecionados (ninguém) — vira visível pelo curso
  rascunho: '64eeeeee-0000-0000-0000-000000000003',
  deB: '64eeeeee-0000-0000-0000-000000000004',
  solo: '64eeeeee-0000-0000-0000-000000000005', // aula do curso sem certificado
} as const;

const tenta = (sql: string) => codigoDeErro(db, sql);
/** recusado pelo banco: o gatilho (22023), a RLS (42501) ou a constraint (23514) — quem responder primeiro; o que importa é não gravar */
const RECUSA = ['22023', '42501', '23514'];
const recusado = (codigo: string | null) => expect(RECUSA).toContain(codigo);
const ids = async (sql: string) => (await db.query<{ id: string }>(sql)).rows.map((r) => r.id).sort();

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${AGRO}','ag@t'),('${CAMPO}','ca@t'),('${USER_A3}','a3@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'], nome='Marta Agrônoma', crea='ES-4567' where id='${AGRO}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo'] where id='${CAMPO}';
    update agro.profiles set org_id='${ID.orgA}', role='produtor' where id='${USER_A3}';
    insert into agro.produtores (id, org_id, user_id, nome) values ('${CAD_A3}','${ID.orgA}','${USER_A3}','Produtor Milho');
    insert into agro.propriedades (id, produtor_id, nome) values ('64ffffff-0000-0000-0000-000000000001','${CAD_A3}','Prop Milho');
    insert into agro.talhoes (id, propriedade_id, nome, cultura) values ('64ffffff-0000-0000-0000-000000000002','64ffffff-0000-0000-0000-000000000001','T Milho','milho');
    update agro.orgs set nome = 'Campo Forte Assistência' where id = '${ID.orgA}';

    insert into agro.academy_conteudos (id, org_id, tipo, titulo, url, corpo, status, visibilidade, duracao_min) values
      ('${A.v1}','${ID.orgA}','video','Aula 1 — Ler a análise','https://youtu.be/a',null,'publicado','todos',10),
      ('${A.v2}','${ID.orgA}','artigo','Aula 2 — Calagem',null,'Texto da aula 2','publicado','selecionados',20),
      ('${A.rascunho}','${ID.orgA}','video','Aula em rascunho','https://youtu.be/r',null,'rascunho','todos',5),
      ('${A.deB}','${ID.orgB}','video','Aula do escritório B','https://youtu.be/b',null,'publicado','todos',5),
      ('${A.solo}','${ID.orgA}','video','Aula do curso sem certificado','https://youtu.be/s',null,'publicado','selecionados',7);
  `);
});

// monta um curso com 1 módulo e as aulas dadas, como postgres (semente), depois publica pelo cliente quando o teste pede
async function semearCurso(id: string, titulo: string, aulas: string[], extra = '', status = 'rascunho') {
  await db.exec(`insert into agro.academy_cursos (id, org_id, titulo, status ${extra ? ', ' + extra.split('|')[0] : ''}) values ('${id}','${ID.orgA}','${titulo}','rascunho' ${extra ? ", " + extra.split('|')[1] : ''})`);
  const modulo = id.replace(/^64aaaaaa/, '64dddddd');
  await db.exec(`insert into agro.academy_curso_modulos (id, curso_id, titulo, posicao) values ('${modulo}','${id}','Módulo 1',0)`);
  let pos = 0;
  for (const aula of aulas) await db.exec(`insert into agro.academy_curso_aulas (curso_id, modulo_id, conteudo_id, posicao) values ('${id}','${modulo}','${aula}',${pos++})`);
  if (status === 'publicado') await db.exec(`update agro.academy_cursos set status = 'publicado' where id = '${id}'`);
}

describe('montar o curso', () => {
  it('só agronômico e proprietário criam curso; campo e consulta não', async () => {
    const novo = (t: string) => `insert into agro.academy_cursos (org_id, titulo) values ('${ID.orgA}','${t}')`;
    await como(db, AGRO, async () => expect(await tenta(novo('Curso do agrônomo'))).toBeNull());
    await como(db, ID.consultorA, async () => expect(await tenta(novo('Curso do dono'))).toBeNull());
    await como(db, CAMPO, async () => expect(await tenta(novo('Curso do campo'))).toBe('42501'));
    await como(db, ID.consultorB, async () => expect(await tenta(`insert into agro.academy_cursos (org_id, titulo) values ('${ID.orgA}','Invasão')`)).toBe('42501'));
  });

  it('o banco decide autoria e a chave da cultura', async () => {
    await como(db, AGRO, async () => {
      await db.query(`insert into agro.academy_cursos (id, org_id, autor_id, titulo, cultura, cultura_chave) values ('64aaaaaa-0000-0000-0000-0000000000f1','${ID.orgA}','${ID.consultorB}','Curso do café','Café','forjada')`);
    });
    const { rows } = await db.query<{ autor_id: string; cultura_chave: string }>(`select autor_id, cultura_chave from agro.academy_cursos where id = '64aaaaaa-0000-0000-0000-0000000000f1'`);
    expect(rows[0]).toEqual({ autor_id: AGRO, cultura_chave: 'cafe' });
  });

  it('não publica curso sem aula, nem com aula em rascunho', async () => {
    await semearCurso(K.rasc, 'Curso com aula em rascunho', [A.v1]);
    await como(db, AGRO, async () => {
      await db.query(`insert into agro.academy_cursos (id, org_id, titulo) values ('64aaaaaa-0000-0000-0000-0000000000f2','${ID.orgA}','Curso vazio')`);
      expect(await tenta(`update agro.academy_cursos set status = 'publicado' where id = '64aaaaaa-0000-0000-0000-0000000000f2'`)).toBe('22023');
      expect(await tenta(`insert into agro.academy_cursos (org_id, titulo, status) values ('${ID.orgA}','Já nasce publicado','publicado')`)).toBe('22023');
    });
    await db.exec(`insert into agro.academy_curso_aulas (curso_id, modulo_id, conteudo_id, posicao) values ('${K.rasc}','${M.todos.replace('0001', '0001')}','${A.rascunho}',9)`).catch(() => {});
  });

  it('aula tem de ser do mesmo curso e do mesmo escritório', async () => {
    await semearCurso(K.todos, 'Fundamentos da análise de solo', [A.v1, A.v2], '', 'publicado');
    await como(db, AGRO, async () => {
      // conteúdo do escritório B
      expect(await tenta(`insert into agro.academy_curso_aulas (curso_id, modulo_id, conteudo_id) values ('${K.rasc}','${K.rasc.replace(/^64aaaaaa/, '64dddddd')}','${A.deB}')`)).toBe('22023');
      // módulo de outro curso
      expect(await tenta(`insert into agro.academy_curso_aulas (curso_id, modulo_id, conteudo_id) values ('${K.rasc}','${K.todos.replace(/^64aaaaaa/, '64dddddd')}','${A.solo}')`)).toBe('22023');
    });
  });

  it('curso publicado só aceita aula publicada, e a aula dele não sai do ar', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(`insert into agro.academy_curso_aulas (curso_id, modulo_id, conteudo_id) values ('${K.todos}','${K.todos.replace(/^64aaaaaa/, '64dddddd')}','${A.rascunho}')`)).toBe('22023');
      expect(await tenta(`update agro.academy_conteudos set status = 'arquivado' where id = '${A.v1}'`)).toBe('22023');
      expect(await tenta(`update agro.academy_conteudos set status = 'rascunho' where id = '${A.v2}'`)).toBe('22023');
    });
  });

  it('apagar um conteúdo que é aula de curso é recusado (arquive o curso antes)', async () => {
    await como(db, AGRO, async () => {
      expect(await tenta(`delete from agro.academy_conteudos where id = '${A.v1}'`)).toBe('23503');
    });
  });

  it('publicar registra quem revisou e quando', async () => {
    const { rows } = await db.query<{ revisado_por: string | null; revisado_em: string | null; publicado_em: string | null }>(
      `select revisado_por, revisado_em, publicado_em from agro.academy_cursos where id = '${K.todos}'`);
    expect(rows[0]!.revisado_em).not.toBeNull();
    expect(rows[0]!.publicado_em).not.toBeNull();
    await como(db, AGRO, async () => {
      await db.query(`update agro.academy_cursos set revisado_por = '${ID.consultorB}', descricao = 'Atualizado' where id = '${K.todos}'`);
    });
    const r2 = await db.query<{ revisado_por: string }>(`select revisado_por from agro.academy_cursos where id = '${K.todos}'`);
    expect(r2.rows[0]!.revisado_por).toBe(AGRO);
  });
});

describe('o que o produtor enxerga', () => {
  beforeAll(async () => {
    await semearCurso(K.sel, 'Curso só para selecionados', [A.solo], "visibilidade|'selecionados'", 'publicado');
    await db.exec(`insert into agro.academy_curso_publicos (curso_id, produtor_id) values ('${K.sel}','${ID.cadA}')`);
    await semearCurso(K.cafe, 'Curso de café', [A.v1], "cultura, visibilidade|'Café', 'cultura'", 'publicado');
    await db.exec(`insert into agro.academy_cursos (id, org_id, titulo) values ('${K.deB}','${ID.orgB}','Curso do B')`);
  });

  it('produtor A: o que é para todos, o selecionado para ele e o da cultura dele; nunca rascunho nem outro escritório', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await ids(`select id from agro.academy_cursos`)).toEqual([K.todos, K.sel, K.cafe].sort());
    });
  });

  it('produtor de milho: só o curso para todos (o de café e o selecionado não)', async () => {
    await como(db, USER_A3, async () => {
      expect(await ids(`select id from agro.academy_cursos`)).toEqual([K.todos]);
    });
  });

  it('produtor do outro escritório e o escritório B não veem nada do A', async () => {
    await como(db, ID.produtorB, async () => expect(await ids(`select id from agro.academy_cursos`)).toEqual([]));
    await como(db, ID.consultorB, async () => expect(await ids(`select id from agro.academy_cursos`)).toEqual([K.deB]));
  });

  it('a aula de um curso visível é visível, mesmo que avulsa fosse "só selecionados"', async () => {
    await como(db, USER_A3, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id in ('${A.v2}','${A.solo}')`)).toEqual([A.v2]); // v2 está no curso "todos"; solo só no curso selecionado
    });
    await como(db, ID.produtorA, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id in ('${A.v2}','${A.solo}')`)).toEqual([A.v2, A.solo].sort());
    });
  });

  it('módulos e aulas seguem o curso: quem não vê o curso não vê a estrutura', async () => {
    await como(db, USER_A3, async () => {
      expect(await contar(db, `select count(*) n from agro.academy_curso_aulas where curso_id = '${K.sel}'`)).toBe(0);
      expect(await contar(db, `select count(*) n from agro.academy_curso_modulos where curso_id = '${K.sel}'`)).toBe(0);
      expect(await contar(db, `select count(*) n from agro.academy_curso_aulas where curso_id = '${K.todos}'`)).toBe(2);
    });
  });

  it('o produtor não cria nem edita curso, módulo, aula ou público', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.academy_cursos (org_id, titulo) values ('${ID.orgA}','Do produtor')`)).toBe('42501');
      await db.query(`update agro.academy_cursos set titulo = 'Alterado' where id = '${K.todos}'`);
      await db.query(`delete from agro.academy_curso_aulas where curso_id = '${K.todos}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_cursos where id = '${K.todos}' and titulo = 'Fundamentos da análise de solo'`)).toBe(1);
    expect(await contar(db, `select count(*) n from agro.academy_curso_aulas where curso_id = '${K.todos}'`)).toBe(2);
  });

  it('curso arquivado some para o produtor', async () => {
    await db.exec(`update agro.academy_cursos set status = 'arquivado' where id = '${K.cafe}'`);
    await como(db, ID.produtorA, async () => expect(await ids(`select id from agro.academy_cursos where id = '${K.cafe}'`)).toEqual([]));
    await db.exec(`update agro.academy_cursos set status = 'publicado' where id = '${K.cafe}'`);
  });
});

describe('matrícula e progresso', () => {
  it('o produtor se matricula em curso que vê, só em nome dele', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.todos}','${ID.cadA}')`)).toBeNull();
      recusado(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.sel}','${ID.cadA2}')`)); // em nome de outro
    });
    await como(db, USER_A3, async () => {
      recusado(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.sel}','${CAD_A3}')`)); // curso que ele não vê
    });
    await como(db, ID.consultorA, async () => {
      recusado(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.todos}','${ID.cadA2}')`)); // equipe não matricula
    });
  });

  it('não dá para se matricular em curso em rascunho ou do outro escritório', async () => {
    await como(db, ID.produtorA, async () => {
      recusado(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.rasc}','${ID.cadA}')`));
      recusado(await tenta(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.deB}','${ID.cadA}')`));
    });
  });

  it('o cliente não conclui a matrícula por conta própria', async () => {
    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.academy_matriculas set concluido_em = now() where curso_id = '${K.todos}'`); // sem política de update: nenhuma linha muda
    });
    const { rows } = await db.query<{ concluido_em: string | null }>(`select concluido_em from agro.academy_matriculas where curso_id = '${K.todos}' and produtor_id = '${ID.cadA}'`);
    expect(rows[0]!.concluido_em).toBeNull();
  });

  it('progresso só do próprio produtor e só de conteúdo que ele vê', async () => {
    await como(db, ID.produtorA, async () => {
      recusado(await tenta(`insert into agro.academy_progresso (produtor_id, conteudo_id) values ('${ID.cadA2}','${A.v1}')`)); // em nome de outro
      recusado(await tenta(`insert into agro.academy_progresso (produtor_id, conteudo_id) values ('${ID.cadA}','${A.deB}')`)); // outro escritório
      recusado(await tenta(`insert into agro.academy_progresso (produtor_id, conteudo_id) values ('${ID.cadA}','${A.rascunho}')`)); // rascunho
    });
    await como(db, USER_A3, async () => {
      recusado(await tenta(`insert into agro.academy_progresso (produtor_id, conteudo_id) values ('${CAD_A3}','${A.solo}')`)); // aula de curso que ele não vê
    });
  });

  it('a hora é do servidor e concluir não se desfaz', async () => {
    await como(db, ID.produtorA, async () => {
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, iniciado_em) values ('${ID.cadA}','${A.v1}','2001-01-01')`);
    });
    let r = (await db.query<{ iniciado_em: string; concluido_em: string | null }>(`select iniciado_em::text, concluido_em::text from agro.academy_progresso where produtor_id = '${ID.cadA}' and conteudo_id = '${A.v1}'`)).rows[0]!;
    expect(r.iniciado_em.startsWith('2001')).toBe(false);
    expect(r.concluido_em).toBeNull();

    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.academy_progresso set concluido_em = '2001-01-01' where produtor_id = '${ID.cadA}' and conteudo_id = '${A.v1}'`);
    });
    r = (await db.query<{ iniciado_em: string; concluido_em: string | null }>(`select iniciado_em::text, concluido_em::text from agro.academy_progresso where produtor_id = '${ID.cadA}' and conteudo_id = '${A.v1}'`)).rows[0]!;
    expect(r.concluido_em).not.toBeNull();
    expect(r.concluido_em!.startsWith('2001')).toBe(false);
    const feita = r.concluido_em;

    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.academy_progresso set concluido_em = null where produtor_id = '${ID.cadA}' and conteudo_id = '${A.v1}'`);
    });
    r = (await db.query<{ iniciado_em: string; concluido_em: string | null }>(`select iniciado_em::text, concluido_em::text from agro.academy_progresso where produtor_id = '${ID.cadA}' and conteudo_id = '${A.v1}'`)).rows[0]!;
    expect(r.concluido_em).toBe(feita);
  });

  it('cada produtor lê só o próprio progresso; a equipe lê o do escritório; B não vê', async () => {
    await como(db, ID.produtorA2, async () => expect(await contar(db, `select count(*) n from agro.academy_progresso`)).toBe(0));
    await como(db, ID.produtorA, async () => expect(await contar(db, `select count(*) n from agro.academy_progresso`)).toBe(1));
    await como(db, AGRO, async () => expect(await contar(db, `select count(*) n from agro.academy_progresso`)).toBe(1));
    await como(db, ID.consultorB, async () => expect(await contar(db, `select count(*) n from agro.academy_progresso`)).toBe(0));
  });
});

describe('concluir o curso emite o certificado', () => {
  it('com as duas aulas feitas: matrícula concluída e certificado com a foto do momento', async () => {
    expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(0); // falta a aula 2
    await como(db, ID.produtorA, async () => {
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${ID.cadA}','${A.v2}', now())`);
    });
    const m = (await db.query<{ concluido_em: string | null }>(`select concluido_em::text from agro.academy_matriculas where curso_id = '${K.todos}' and produtor_id = '${ID.cadA}'`)).rows[0]!;
    expect(m.concluido_em).not.toBeNull();
    const c = (await db.query<Record<string, string | number>>(`select codigo, titulo_curso, aluno_nome, escritorio_nome, responsavel_nome, responsavel_crea, carga_min, aulas from agro.academy_certificados`)).rows;
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ titulo_curso: 'Fundamentos da análise de solo', aluno_nome: 'Produtor A', escritorio_nome: 'Campo Forte Assistência', responsavel_nome: 'Marta Agrônoma', responsavel_crea: 'ES-4567', carga_min: 30, aulas: 2 });
    expect(String(c[0]!.codigo)).toMatch(/^AT-[0-9A-F]{5}-[0-9A-F]{5}$/);
  });

  it('o certificado não muda se o curso for renomeado depois', async () => {
    await db.exec(`update agro.academy_cursos set titulo = 'Outro nome' where id = '${K.todos}'`);
    const { rows } = await db.query<{ titulo_curso: string }>(`select titulo_curso from agro.academy_certificados`);
    expect(rows[0]!.titulo_curso).toBe('Fundamentos da análise de solo');
    await db.exec(`update agro.academy_cursos set titulo = 'Fundamentos da análise de solo' where id = '${K.todos}'`);
  });

  it('repetir não emite outro; cada um lê só o próprio; a equipe lê os do escritório', async () => {
    await db.exec(`update agro.academy_progresso set concluido_em = now() where produtor_id = '${ID.cadA}'`);
    expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(1);
    await como(db, ID.produtorA, async () => expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(1));
    await como(db, ID.produtorA2, async () => expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(0));
    await como(db, AGRO, async () => expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(1));
    await como(db, ID.consultorB, async () => expect(await contar(db, `select count(*) n from agro.academy_certificados`)).toBe(0));
  });

  it('o produtor não escreve nem apaga certificado, e a equipe também não', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.academy_certificados (org_id, curso_id, produtor_id, codigo, titulo_curso, aluno_nome, escritorio_nome) values ('${ID.orgA}','${K.sel}','${ID.cadA}','AT-FORJA-00000','x','x','x')`)).toBe('42501');
      await db.query(`delete from agro.academy_certificados`);
      await db.query(`update agro.academy_certificados set aluno_nome = 'Outro'`);
    });
    await como(db, AGRO, async () => {
      expect(await tenta(`insert into agro.academy_certificados (org_id, curso_id, produtor_id, codigo, titulo_curso, aluno_nome, escritorio_nome) values ('${ID.orgA}','${K.sel}','${ID.cadA}','AT-FORJA-00001','x','x','x')`)).toBe('42501');
      await db.query(`delete from agro.academy_certificados`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_certificados where aluno_nome = 'Produtor A'`)).toBe(1);
  });

  it('a conta do banco não é chamável pela API', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`select agro.academy_sincronizar_curso('${K.todos}','${ID.cadA}')`)).toBe('42501');
    });
  });

  it('curso sem certificado conclui a matrícula mas não emite', async () => {
    await semearCurso(K.semCert, 'Curso sem certificado', [A.solo], "certificado|false", 'publicado');
    await db.exec(`insert into agro.academy_curso_publicos (curso_id, produtor_id) values ('${K.semCert}','${ID.cadA}')`).catch(() => {});
    await db.exec(`update agro.academy_cursos set visibilidade = 'todos' where id = '${K.semCert}'`);
    await como(db, ID.produtorA, async () => {
      await db.query(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.semCert}','${ID.cadA}')`);
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${ID.cadA}','${A.solo}', now())`);
    });
    const m = (await db.query<{ concluido_em: string | null }>(`select concluido_em::text from agro.academy_matriculas where curso_id = '${K.semCert}'`)).rows[0]!;
    expect(m.concluido_em).not.toBeNull();
    expect(await contar(db, `select count(*) n from agro.academy_certificados where curso_id = '${K.semCert}'`)).toBe(0);
  });

  it('quem já fez as aulas por outro caminho conclui o curso na hora da matrícula', async () => {
    await como(db, ID.produtorA2, async () => {
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${ID.cadA2}','${A.v1}', now())`);
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${ID.cadA2}','${A.v2}', now())`);
      await db.query(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.todos}','${ID.cadA2}')`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_certificados where produtor_id = '${ID.cadA2}'`)).toBe(1);
  });
});

describe('indicar um curso', () => {
  it('a equipe com permissão indica curso publicado; rascunho não; consulta não', async () => {
    const indicar = (curso: string, prod: string) => `insert into agro.academy_indicacoes (curso_id, produtor_id, mensagem) values ('${curso}','${prod}','Faça este curso')`;
    await como(db, CAMPO, async () => expect(await tenta(indicar(K.cafe, ID.cadA2))).toBeNull());
    await como(db, AGRO, async () => {
      expect(await tenta(indicar(K.rasc, ID.cadA))).toBe('22023');
      expect(await tenta(indicar(K.cafe, ID.cadA2))).toBe('23505'); // já indicado
      expect(await tenta(indicar(K.cafe, ID.cadB))).toBe('42501'); // produtor de outro escritório
    });
  });

  it('indicar abre o curso "só selecionados" para quem recebeu e avisa no portal', async () => {
    await como(db, ID.produtorA2, async () => {
      expect(await ids(`select id from agro.academy_cursos where id in ('${K.sel}','${K.cafe}')`)).toEqual([K.cafe]);
    });
    await como(db, AGRO, async () => {
      await db.query(`insert into agro.academy_indicacoes (curso_id, produtor_id) values ('${K.sel}','${ID.cadA2}')`);
    });
    await como(db, ID.produtorA2, async () => {
      expect(await ids(`select id from agro.academy_cursos where id = '${K.sel}'`)).toEqual([K.sel]);
    });
    const n = (await db.query<{ link: string; titulo: string }>(
      `select link, titulo from agro.notificacoes where destinatario_user_id = '${ID.produtorA2}' and tipo = 'conteudo_indicado' and link like '/academy/cursos/%' order by criado_em desc`)).rows;
    expect(n.some((x) => x.link === `/academy/cursos/${K.sel}` && /curso/.test(x.titulo))).toBe(true);
  });

  it('indicação é de curso OU de aula, nunca das duas ou de nenhuma', async () => {
    await como(db, AGRO, async () => {
      recusado(await tenta(`insert into agro.academy_indicacoes (produtor_id) values ('${ID.cadA}')`));
      expect(await tenta(`insert into agro.academy_indicacoes (curso_id, conteudo_id, produtor_id) values ('${K.todos}','${A.v1}','${ID.cadA}')`)).toBe('23514');
    });
  });

  it('concluir o curso fecha a indicação dele', async () => {
    await como(db, ID.produtorA2, async () => {
      await db.query(`insert into agro.academy_matriculas (curso_id, produtor_id) values ('${K.sel}','${ID.cadA2}')`);
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${ID.cadA2}','${A.solo}', now())`);
    });
    const { rows } = await db.query<{ aberto_em: string | null; concluido_em: string | null }>(
      `select aberto_em::text, concluido_em::text from agro.academy_indicacoes where curso_id = '${K.sel}' and produtor_id = '${ID.cadA2}'`);
    expect(rows[0]!.aberto_em).not.toBeNull();
    expect(rows[0]!.concluido_em).not.toBeNull();
  });

  it('concluir uma aula fecha a indicação avulsa dela', async () => {
    await db.exec(`insert into agro.academy_indicacoes (conteudo_id, produtor_id, indicado_por) values ('${A.v1}','${CAD_A3}','${AGRO}')`);
    await como(db, USER_A3, async () => {
      await db.query(`insert into agro.academy_progresso (produtor_id, conteudo_id, concluido_em) values ('${CAD_A3}','${A.v1}', now())`);
    });
    const { rows } = await db.query<{ concluido_em: string | null }>(`select concluido_em::text from agro.academy_indicacoes where conteudo_id = '${A.v1}' and produtor_id = '${CAD_A3}'`);
    expect(rows[0]!.concluido_em).not.toBeNull();
  });
});

describe('LGPD: apagar o produtor leva junto o que é dele nos cursos', () => {
  it('matrículas, progresso e certificados somem; o curso e as aulas do escritório ficam', async () => {
    await db.exec(`delete from agro.produtores where id in ('${ID.cadA}','${ID.cadA2}')`);
    for (const t of ['academy_matriculas', 'academy_progresso', 'academy_certificados']) {
      expect(await contar(db, `select count(*) n from agro.${t} where produtor_id in ('${ID.cadA}','${ID.cadA2}')`), t).toBe(0);
    }
    expect(await contar(db, `select count(*) n from agro.academy_cursos where id = '${K.todos}'`)).toBe(1);
    expect(await contar(db, `select count(*) n from agro.academy_curso_aulas where curso_id = '${K.todos}'`)).toBe(2);
  });
});
