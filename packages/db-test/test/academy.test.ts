import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';

/**
 * Academy (0046): o produtor só lê o que foi PUBLICADO e é para ele; escritório e produtor não se enxergam; só quem tem
 * perfil mexe; o produtor marca abertura/conclusão e nada além. Tudo no banco — a regra vale chamando a API direto.
 */
let db: PGlite;

const U = {
  agro: '62111111-0000-0000-0000-000000000001', // agronômico
  campo: '62111111-0000-0000-0000-000000000002',
  leitura: '62111111-0000-0000-0000-000000000003',
} as const;
const dono = ID.consultorA; // proprietário da org A (padrão)

const C = {
  videoTodos: '62aaaaaa-0000-0000-0000-000000000001',
  artigoSel: '62aaaaaa-0000-0000-0000-000000000002',
  rascunho: '62aaaaaa-0000-0000-0000-000000000003',
  arquivado: '62aaaaaa-0000-0000-0000-000000000004',
  material: '62aaaaaa-0000-0000-0000-000000000005',
  deB: '62bbbbbb-0000-0000-0000-000000000001',
} as const;
const VISITA_A2 = '62cccccc-0000-0000-0000-000000000001';

const tenta = (sql: string, params: unknown[] = []) => codigoDeErro(db, sql, params);
const ids = async (sql: string) => (await db.query<{ id: string }>(sql)).rows.map((r) => r.id).sort();

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${U.agro}','ag@t'),('${U.campo}','ca@t'),('${U.leitura}','le@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${U.agro}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo']      where id='${U.campo}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['leitura']    where id='${U.leitura}';
    insert into agro.visitas (id, talhao_id, data) values ('${VISITA_A2}','${ID.talhaoA2}','2026-09-30');

    -- semeia como postgres (sem RLS): o que o escritório já publicou
    insert into agro.academy_conteudos (id, org_id, tipo, titulo, url, corpo, arquivo_path, status, visibilidade) values
      ('${C.videoTodos}','${ID.orgA}','video','Calagem em café','https://youtu.be/abc',null,null,'publicado','todos'),
      ('${C.artigoSel}','${ID.orgA}','artigo','Adubação de cobertura',null,'Texto da aula.',null,'publicado','selecionados'),
      ('${C.rascunho}','${ID.orgA}','video','Rascunho em andamento','https://youtu.be/rasc',null,null,'rascunho','todos'),
      ('${C.arquivado}','${ID.orgA}','video','Aula antiga','https://youtu.be/velha',null,null,'arquivado','todos'),
      ('${C.material}','${ID.orgA}','material','Cartilha de solo',null,null,'${ID.orgA}/${C.material}/cartilha.pdf','publicado','selecionados'),
      ('${C.deB}','${ID.orgB}','video','Aula do escritório B','https://youtu.be/b',null,null,'publicado','todos');
    insert into agro.academy_publicos (conteudo_id, produtor_id) values ('${C.artigoSel}','${ID.cadA}'), ('${C.material}','${ID.cadA}');
    insert into storage.objects (bucket_id, name) values
      ('academy','${ID.orgA}/${C.material}/cartilha.pdf'),
      ('academy','${ID.orgA}/${C.artigoSel}/outro.pdf'),
      ('academy','${ID.orgB}/${C.deB}/dele.pdf');
  `);
});

describe('quem escreve conteúdo (permissão academy.gerenciar)', () => {
  const novo = (titulo: string) => `insert into agro.academy_conteudos (org_id, tipo, titulo, url) values ('${ID.orgA}','video','${titulo}','https://youtu.be/x')`;

  it('agronômico e proprietário criam; campo e consulta não', async () => {
    await como(db, U.agro, async () => expect(await tenta(novo('Aula do agrônomo'))).toBeNull());
    await como(db, dono, async () => expect(await tenta(novo('Aula do dono'))).toBeNull());
    await como(db, U.campo, async () => expect(await tenta(novo('Aula do campo'))).toBe('42501'));
    await como(db, U.leitura, async () => expect(await tenta(novo('Aula da consulta'))).toBe('42501'));
  });

  it('campo e consulta também não editam nem apagam o que existe', async () => {
    for (const quem of [U.campo, U.leitura]) {
      await como(db, quem, async () => {
        await db.query(`update agro.academy_conteudos set titulo = 'Alterado por engano' where id = '${C.videoTodos}'`);
        await db.query(`delete from agro.academy_conteudos where id = '${C.videoTodos}'`);
      });
    }
    expect(await contar(db, `select count(*) n from agro.academy_conteudos where id = '${C.videoTodos}' and titulo = 'Calagem em café'`)).toBe(1);
  });

  it('o escritório B não escreve no A (nem em nome do A)', async () => {
    await como(db, ID.consultorB, async () => {
      expect(await tenta(novo('Invasão'))).toBe('42501');
      await db.query(`update agro.academy_conteudos set titulo = 'Invadido' where id = '${C.videoTodos}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_conteudos where titulo = 'Invadido'`)).toBe(0);
  });
});

describe('o banco decide autoria e revisão', () => {
  it('autor é quem salvou, mesmo que o cliente mande outro', async () => {
    await como(db, U.agro, async () => {
      await db.query(`insert into agro.academy_conteudos (id, org_id, autor_id, tipo, titulo, url) values ('62dddddd-0000-0000-0000-000000000001','${ID.orgA}','${ID.consultorB}','video','Autoria','https://youtu.be/a')`);
    });
    const { rows } = await db.query<{ autor_id: string }>(`select autor_id from agro.academy_conteudos where id = '62dddddd-0000-0000-0000-000000000001'`);
    expect(rows[0]!.autor_id).toBe(U.agro);
  });

  it('publicar grava quem revisou e quando; rascunho não ganha revisão forjada', async () => {
    await como(db, U.agro, async () => {
      await db.query(`update agro.academy_conteudos set revisado_por = '${ID.consultorA}', revisado_em = '2020-01-01' where id = '62dddddd-0000-0000-0000-000000000001'`);
    });
    let r = (await db.query<{ revisado_por: string | null; revisado_em: string | null; publicado_em: string | null }>(
      `select revisado_por, revisado_em, publicado_em from agro.academy_conteudos where id = '62dddddd-0000-0000-0000-000000000001'`)).rows[0]!;
    expect(r).toEqual({ revisado_por: null, revisado_em: null, publicado_em: null });

    await como(db, U.agro, async () => {
      await db.query(`update agro.academy_conteudos set status = 'publicado', revisado_por = '${ID.consultorA}' where id = '62dddddd-0000-0000-0000-000000000001'`);
    });
    r = (await db.query<{ revisado_por: string | null; revisado_em: string | null; publicado_em: string | null }>(
      `select revisado_por, revisado_em, publicado_em from agro.academy_conteudos where id = '62dddddd-0000-0000-0000-000000000001'`)).rows[0]!;
    expect(r.revisado_por).toBe(U.agro);
    expect(r.revisado_em).not.toBeNull();
    expect(r.publicado_em).not.toBeNull();
  });

  it('o escritório de um conteúdo não muda', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`update agro.academy_conteudos set org_id = '${ID.orgB}' where id = '${C.videoTodos}'`)).toBe('42501');
    });
  });

  it('o arquivo tem de estar na pasta do escritório', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.academy_conteudos (org_id, tipo, titulo, arquivo_path) values ('${ID.orgA}','material','Cartilha roubada','${ID.orgB}/${C.deB}/dele.pdf')`)).toBe('22023');
    });
  });
});

describe('só publica o que tem o que mostrar, e link só por https', () => {
  const tenta2 = (sql: string) => como(db, U.agro, () => tenta(sql));

  it('vídeo sem link, artigo sem texto e material sem arquivo não publicam', async () => {
    expect(await tenta2(`insert into agro.academy_conteudos (org_id, tipo, titulo, status) values ('${ID.orgA}','video','Sem link','publicado')`)).toBe('23514');
    expect(await tenta2(`insert into agro.academy_conteudos (org_id, tipo, titulo, status, corpo) values ('${ID.orgA}','artigo','Sem texto','publicado','   ')`)).toBe('23514');
    expect(await tenta2(`insert into agro.academy_conteudos (org_id, tipo, titulo, status) values ('${ID.orgA}','material','Sem arquivo','publicado')`)).toBe('23514');
  });

  it('rascunho incompleto pode existir', async () => {
    expect(await tenta2(`insert into agro.academy_conteudos (org_id, tipo, titulo) values ('${ID.orgA}','video','Ainda sem link')`)).toBeNull();
  });

  it('link só https (nada de http, javascript: ou data:)', async () => {
    for (const url of ['http://exemplo.com/a', 'javascript:alert(1)', 'data:text/html,x', 'https://com espaço.com']) {
      expect(await tenta2(`insert into agro.academy_conteudos (org_id, tipo, titulo, url) values ('${ID.orgA}','video','Link ruim','${url}')`)).toBe('23514');
    }
  });
});

describe('o que o produtor enxerga', () => {
  it('produtor A: o publicado para todos + o que foi selecionado para ele; nunca rascunho nem arquivado', async () => {
    await como(db, ID.produtorA, async () => {
      const vistos = await ids(`select id from agro.academy_conteudos where id in ('${C.videoTodos}','${C.artigoSel}','${C.rascunho}','${C.arquivado}','${C.material}','${C.deB}')`);
      expect(vistos).toEqual([C.videoTodos, C.artigoSel, C.material].sort());
    });
  });

  it('produtor A2 (mesmo escritório, não selecionado): só o publicado para todos', async () => {
    await como(db, ID.produtorA2, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id in ('${C.videoTodos}','${C.artigoSel}','${C.material}')`)).toEqual([C.videoTodos]);
    });
  });

  it('produtor de OUTRO escritório não vê nada do A', async () => {
    await como(db, ID.produtorB, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.deB]);
      expect(await contar(db, `select count(*) n from agro.academy_publicos`)).toBe(0);
    });
  });

  it('o escritório B também não vê o A', async () => {
    await como(db, ID.consultorB, async () => {
      expect(await ids(`select id from agro.academy_conteudos`)).toEqual([C.deB]);
    });
  });

  it('produtor não cria, edita nem apaga conteúdo', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`insert into agro.academy_conteudos (org_id, tipo, titulo, url) values ('${ID.orgA}','video','Do produtor','https://youtu.be/p')`)).toBe('42501');
      await db.query(`update agro.academy_conteudos set titulo = 'Do produtor' where id = '${C.videoTodos}'`);
      await db.query(`delete from agro.academy_conteudos where id = '${C.videoTodos}'`);
      expect(await tenta(`insert into agro.academy_publicos (conteudo_id, produtor_id) values ('${C.videoTodos}','${ID.cadA}')`)).toBe('42501');
    });
    expect(await contar(db, `select count(*) n from agro.academy_conteudos where id = '${C.videoTodos}' and titulo = 'Calagem em café'`)).toBe(1);
  });

  it('a equipe vê tudo do próprio escritório, inclusive rascunho', async () => {
    await como(db, U.leitura, async () => {
      expect(await contar(db, `select count(*) n from agro.academy_conteudos where org_id = '${ID.orgA}' and id in ('${C.rascunho}','${C.arquivado}')`)).toBe(2);
    });
  });
});

describe('públicos do conteúdo', () => {
  it('só selecionam produtor do próprio escritório', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.academy_publicos (conteudo_id, produtor_id) values ('${C.artigoSel}','${ID.cadA2}')`)).toBeNull();
      expect(await tenta(`insert into agro.academy_publicos (conteudo_id, produtor_id) values ('${C.artigoSel}','${ID.cadB}')`)).toBe('42501');
    });
    await db.exec(`delete from agro.academy_publicos where conteudo_id = '${C.artigoSel}' and produtor_id = '${ID.cadA2}'`);
  });

  it('campo não mexe em público (é parte de gerenciar)', async () => {
    await como(db, U.campo, async () => {
      expect(await tenta(`insert into agro.academy_publicos (conteudo_id, produtor_id) values ('${C.artigoSel}','${ID.cadA2}')`)).toBe('42501');
    });
  });
});

describe('indicações', () => {
  const indicar = (conteudo: string, produtor: string, extra = '') =>
    `insert into agro.academy_indicacoes (conteudo_id, produtor_id, mensagem ${extra ? ', ' + extra.split('=')[0] : ''}) values ('${conteudo}','${produtor}','Assista antes da visita' ${extra ? ", '" + extra.split('=')[1] + "'" : ''})`;

  it('agronômico e campo indicam; consulta não', async () => {
    await como(db, U.agro, async () => expect(await tenta(indicar(C.videoTodos, ID.cadA))).toBeNull());
    await como(db, U.campo, async () => expect(await tenta(indicar(C.videoTodos, ID.cadA2))).toBeNull());
    await como(db, U.leitura, async () => expect(await tenta(indicar(C.artigoSel, ID.cadA2))).toBe('42501'));
  });

  it('o banco registra quem indicou e avisa o produtor no portal', async () => {
    const { rows } = await db.query<{ indicado_por: string; org_id: string }>(
      `select indicado_por, org_id from agro.academy_indicacoes where conteudo_id = '${C.videoTodos}' and produtor_id = '${ID.cadA}'`);
    expect(rows[0]).toEqual({ indicado_por: U.agro, org_id: ID.orgA });
    const n = await db.query<{ titulo: string; link: string; corpo: string }>(
      `select titulo, link, corpo from agro.notificacoes where destinatario_user_id = '${ID.produtorA}' and tipo = 'conteudo_indicado'`);
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]!.titulo).toContain('Calagem em café');
    expect(n.rows[0]!.link).toBe(`/academy/aula/${C.videoTodos}`);
    expect(n.rows[0]!.corpo).toBe('Assista antes da visita');
  });

  it('uma indicação por conteúdo e produtor; só conteúdo publicado; só produtor do escritório', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(indicar(C.videoTodos, ID.cadA))).toBe('23505');
      expect(await tenta(indicar(C.rascunho, ID.cadA))).toBe('22023');
      expect(await tenta(indicar(C.arquivado, ID.cadA))).toBe('22023');
      expect(await tenta(indicar(C.videoTodos, ID.cadB))).toBe('42501');
      expect(await tenta(indicar(C.deB, ID.cadA))).toBe('22023'); // conteúdo do outro escritório nem aparece
    });
  });

  it('contexto: a visita tem de ser do mesmo produtor', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(indicar(C.material, ID.cadA, `visita_id=${VISITA_A2}`))).toBe('22023'); // visita é do produtor A2
      expect(await tenta(indicar(C.material, ID.cadA2, `visita_id=${VISITA_A2}`))).toBeNull();
    });
  });

  it('indicar abre o conteúdo "selecionado" para aquele produtor, e só para ele', async () => {
    await como(db, ID.produtorA2, async () => {
      expect(await ids(`select id from agro.academy_conteudos where id = '${C.material}'`)).toEqual([C.material]);
      expect(await ids(`select id from agro.academy_conteudos where id = '${C.artigoSel}'`)).toEqual([]);
    });
  });

  it('cada produtor vê só as próprias indicações', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await contar(db, `select count(*) n from agro.academy_indicacoes`)).toBe(1);
    });
    await como(db, ID.produtorB, async () => {
      expect(await contar(db, `select count(*) n from agro.academy_indicacoes`)).toBe(0);
    });
    await como(db, ID.consultorB, async () => {
      expect(await contar(db, `select count(*) n from agro.academy_indicacoes`)).toBe(0);
    });
  });

  it('o produtor marca que abriu e que concluiu — uma vez, com a hora do servidor — e nada além', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`update agro.academy_indicacoes set mensagem = 'mudei' where conteudo_id = '${C.videoTodos}'`)).toBe('42501');
      expect(await tenta(`update agro.academy_indicacoes set produtor_id = '${ID.cadA2}' where conteudo_id = '${C.videoTodos}'`)).toBe('42501');
      await db.query(`update agro.academy_indicacoes set aberto_em = '2001-01-01' where conteudo_id = '${C.videoTodos}'`);
    });
    const a = (await db.query<{ aberto_em: string; concluido_em: string | null }>(
      `select aberto_em::text, concluido_em::text from agro.academy_indicacoes where conteudo_id = '${C.videoTodos}' and produtor_id = '${ID.cadA}'`)).rows[0]!;
    expect(a.aberto_em.startsWith('2001')).toBe(false); // a hora é do servidor, não do cliente
    expect(a.concluido_em).toBeNull();

    await como(db, ID.produtorA, async () => {
      await db.query(`update agro.academy_indicacoes set aberto_em = null, concluido_em = now() where conteudo_id = '${C.videoTodos}'`);
    });
    const b = (await db.query<{ aberto_em: string; concluido_em: string }>(
      `select aberto_em::text, concluido_em::text from agro.academy_indicacoes where conteudo_id = '${C.videoTodos}' and produtor_id = '${ID.cadA}'`)).rows[0]!;
    expect(b.aberto_em).toBe(a.aberto_em); // abrir não "desabre"
    expect(b.concluido_em).not.toBeNull();
  });

  it('outro produtor não mexe na indicação alheia, e o produtor não apaga a própria', async () => {
    await como(db, ID.produtorA2, async () => {
      await db.query(`update agro.academy_indicacoes set concluido_em = now() where produtor_id = '${ID.cadA}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_indicacoes where produtor_id = '${ID.cadA}' and concluido_em is not null`)).toBe(1); // o dele mesmo, não pelo A2
    await como(db, ID.produtorA, async () => {
      await db.query(`delete from agro.academy_indicacoes where produtor_id = '${ID.cadA}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_indicacoes where produtor_id = '${ID.cadA}'`)).toBe(1);
  });

  it('o escritório desfaz uma indicação (com permissão)', async () => {
    await como(db, U.leitura, async () => {
      await db.query(`delete from agro.academy_indicacoes where produtor_id = '${ID.cadA2}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_indicacoes where produtor_id = '${ID.cadA2}'`)).toBe(2);
    await como(db, U.agro, async () => {
      await db.query(`delete from agro.academy_indicacoes where produtor_id = '${ID.cadA2}'`);
    });
    expect(await contar(db, `select count(*) n from agro.academy_indicacoes where produtor_id = '${ID.cadA2}'`)).toBe(0);
  });
});

describe('arquivos da Academy (Storage)', () => {
  const nomes = async () =>
    (await db.query<{ name: string }>(`select name from storage.objects where bucket_id = 'academy' order by name`)).rows.map((r) => r.name);

  it('o bucket é privado', async () => {
    const { rows } = await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'academy'`);
    expect(rows[0]!.public).toBe(false);
  });

  it('a equipe lê a pasta do próprio escritório e nada do outro', async () => {
    await como(db, U.leitura, async () => {
      expect(await nomes()).toEqual([`${ID.orgA}/${C.artigoSel}/outro.pdf`, `${ID.orgA}/${C.material}/cartilha.pdf`]);
    });
    await como(db, ID.consultorB, async () => {
      expect(await nomes()).toEqual([`${ID.orgB}/${C.deB}/dele.pdf`]);
    });
  });

  it('o produtor lê só o arquivo de um conteúdo que ele pode ver', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await nomes()).toEqual([`${ID.orgA}/${C.material}/cartilha.pdf`]); // o "outro.pdf" não está ligado a conteúdo nenhum
    });
    await db.exec(`update agro.academy_conteudos set arquivo_path = '${ID.orgA}/${C.artigoSel}/outro.pdf' where id = '${C.artigoSel}'`);
    await como(db, ID.produtorA, async () => {
      expect(await nomes()).toContain(`${ID.orgA}/${C.artigoSel}/outro.pdf`); // selecionado para ele
    });
    await como(db, ID.produtorA2, async () => {
      expect(await nomes()).not.toContain(`${ID.orgA}/${C.artigoSel}/outro.pdf`); // A2 não foi selecionado
    });
    await como(db, ID.produtorB, async () => {
      expect(await nomes()).toEqual([]); // o arquivo do escritório B não está ligado a conteúdo nenhum; o do A ele nunca vê
    });
  });

  it('só quem gerencia envia, troca e remove arquivo, e só na pasta do próprio escritório', async () => {
    const envia = (quem: string, caminho: string) =>
      como(db, quem, () => tenta(`insert into storage.objects (bucket_id, name) values ('academy','${caminho}')`));
    expect(await envia(U.agro, `${ID.orgA}/${C.rascunho}/nova.pdf`)).toBeNull();
    expect(await envia(U.campo, `${ID.orgA}/${C.rascunho}/campo.pdf`)).toBe('42501');
    expect(await envia(U.leitura, `${ID.orgA}/${C.rascunho}/leitura.pdf`)).toBe('42501');
    expect(await envia(U.agro, `${ID.orgB}/${C.deB}/invasao.pdf`)).toBe('42501');
    expect(await envia(ID.produtorA, `${ID.orgA}/${C.rascunho}/produtor.pdf`)).toBe('42501');

    await como(db, U.campo, async () => {
      await db.query(`delete from storage.objects where bucket_id = 'academy' and name = '${ID.orgA}/${C.rascunho}/nova.pdf'`);
    });
    expect(await contar(db, `select count(*) n from storage.objects where name = '${ID.orgA}/${C.rascunho}/nova.pdf'`)).toBe(1);
    await como(db, U.agro, async () => {
      await db.query(`delete from storage.objects where bucket_id = 'academy' and name = '${ID.orgA}/${C.rascunho}/nova.pdf'`);
    });
    expect(await contar(db, `select count(*) n from storage.objects where name = '${ID.orgA}/${C.rascunho}/nova.pdf'`)).toBe(0);
  });
});

describe('LGPD: apagar o produtor leva junto o que é dele na Academy', () => {
  it('indicações e seleções somem com o cadastro; o conteúdo do escritório fica', async () => {
    await db.exec(`insert into agro.academy_indicacoes (conteudo_id, produtor_id) values ('${C.videoTodos}','${ID.cadA2}')`);
    await db.exec(`delete from agro.produtores where id in ('${ID.cadA}','${ID.cadA2}')`);
    expect(await contar(db, `select count(*) n from agro.academy_indicacoes where produtor_id in ('${ID.cadA}','${ID.cadA2}')`)).toBe(0);
    expect(await contar(db, `select count(*) n from agro.academy_publicos where produtor_id in ('${ID.cadA}','${ID.cadA2}')`)).toBe(0);
    expect(await contar(db, `select count(*) n from agro.academy_conteudos where id = '${C.videoTodos}'`)).toBe(1);
  });
});
