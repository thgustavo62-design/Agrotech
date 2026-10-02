import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, codigoDeErro, contar, semear, ID } from './banco';
import { ORDEM_PERFIS, TODAS_PERMISSOES, pode } from '../../../apps/web/lib/permissoes';

let db: PGlite;

const U = {
  agro: '61111111-0000-0000-0000-000000000001',
  campo: '61111111-0000-0000-0000-000000000002',
  fin: '61111111-0000-0000-0000-000000000003',
  leitura: '61111111-0000-0000-0000-000000000004',
  dono2: '61111111-0000-0000-0000-000000000005',
  novo: '61111111-0000-0000-0000-000000000006',
} as const;

beforeAll(async () => {
  ({ db } = await bancoMigrado());
  await semear(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.agro}','ag@t'),('${U.campo}','ca@t'),('${U.fin}','fi@t'),('${U.leitura}','le@t'),('${U.dono2}','d2@t');
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico'] where id='${U.agro}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['campo']      where id='${U.campo}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['financeiro'] where id='${U.fin}';
    update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['leitura']    where id='${U.leitura}';
    insert into agro.planos (id, nome, lim_produtores, lim_talhoes, lim_laudos_mes) values ('mini','Mini',1,1,1) on conflict do nothing;
  `);
});

const dono = () => ID.consultorA;
const tenta = (sql: string, params: unknown[] = []) => codigoDeErro(db, sql, params);

describe('falha crítica: o perfil não é um formulário aberto (0037)', () => {
  it('produtor não vira consultor', async () => {
    await como(db, ID.produtorA, async () => {
      // RLS filtra ou o gatilho barra; o importante é que o papel NÃO muda
      await tenta(`update agro.profiles set role = 'consultor' where id = '${ID.produtorA}'`);
    });
    const { rows } = await db.query<{ role: string }>(`select role from agro.profiles where id = '${ID.produtorA}'`);
    expect(rows[0]!.role).toBe('produtor');
  });

  it('o gatilho barra troca de papel e de escritório pelo cliente', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`update agro.profiles set role = 'consultor' where id = '${ID.produtorA}'`)).toBe('42501');
      expect(await tenta(`update agro.profiles set org_id = '${ID.orgB}' where id = '${ID.produtorA}'`)).toBe('42501');
    });
    await como(db, dono(), async () => {
      expect(await tenta(`update agro.profiles set role = 'admin' where id = '${dono()}'`)).toBe('42501');
      expect(await tenta(`update agro.profiles set org_id = '${ID.orgB}' where id = '${dono()}'`)).toBe('42501');
    });
  });

  it('ninguém se promove sozinho', async () => {
    await como(db, U.campo, async () => {
      expect(await tenta(`update agro.profiles set perfis = array['proprietario'] where id = '${U.campo}'`)).toBe('42501');
    });
    const { rows } = await db.query<{ perfis: string[] }>(`select perfis from agro.profiles where id = '${U.campo}'`);
    expect(rows[0]!.perfis).toEqual(['campo']);
  });

  it('cadastro com role=admin nos metadados vira consultor; produtor segue produtor', async () => {
    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${U.novo}','n@t','{"role":"admin"}'),
        ('61111111-0000-0000-0000-0000000000a1','p@t','{"role":"produtor"}')`);
    const { rows } = await db.query<{ id: string; role: string; perfis: string[] }>(
      `select id, role, perfis from agro.profiles where id in ('${U.novo}','61111111-0000-0000-0000-0000000000a1') order by id`,
    );
    expect(rows[0]).toMatchObject({ role: 'consultor', perfis: ['proprietario'] });
    expect(rows[1]).toMatchObject({ role: 'produtor', perfis: [] });
  });

  it('o cliente não cria escritório direto; criar_escritorio promove quem criou (e é idempotente)', async () => {
    await como(db, U.novo, async () => {
      expect(await tenta(`insert into agro.orgs (nome) values ('Invasor')`)).not.toBeNull();
      const { rows } = await db.query<{ id: string }>(`select agro.criar_escritorio('Meu Escritório', 'Colatina', 'es') as id`);
      const org = rows[0]!.id;
      const outra = await db.query<{ id: string }>(`select agro.criar_escritorio('Outro') as id`);
      expect(outra.rows[0]!.id).toBe(org);
    });
    const { rows } = await db.query<{ perfis: string[]; uf: string }>(
      `select p.perfis, o.uf from agro.profiles p join agro.orgs o on o.id = p.org_id where p.id = '${U.novo}'`,
    );
    expect(rows[0]).toEqual({ perfis: ['proprietario'], uf: 'ES' });
  });

  it('produtor não cria escritório', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await tenta(`select agro.criar_escritorio('X')`)).toBe('42501');
    });
  });
});

describe('equipe: quem pode mexer em quem', () => {
  it('só o proprietário altera perfis de outra pessoa', async () => {
    await como(db, U.agro, async () => {
      expect(await tenta(`update agro.profiles set perfis = array['leitura'] where id = '${U.campo}'`)).toBe('42501');
    });
    await como(db, dono(), async () => {
      expect(await tenta(`update agro.profiles set perfis = array['campo','financeiro'] where id = '${U.campo}'`)).toBeNull();
    });
    const { rows } = await db.query<{ perfis: string[] }>(`select perfis from agro.profiles where id = '${U.campo}'`);
    expect(rows[0]!.perfis).toEqual(['campo', 'financeiro']);
    await db.exec(`update agro.profiles set perfis = array['campo'] where id = '${U.campo}'`);
  });

  it('proprietário de outro escritório não mexe na minha equipe', async () => {
    await como(db, ID.consultorB, async () => {
      await tenta(`update agro.profiles set perfis = array['leitura'] where id = '${U.campo}'`);
    });
    const { rows } = await db.query<{ perfis: string[] }>(`select perfis from agro.profiles where id = '${U.campo}'`);
    expect(rows[0]!.perfis).toEqual(['campo']);
  });

  it('o último proprietário não sai nem se rebaixa; com dois, sai', async () => {
    await como(db, dono(), async () => {
      expect(await tenta(`update agro.profiles set perfis = array['agronomico'] where id = '${dono()}'`)).toBe('P0001');
      expect(await tenta(`update agro.profiles set org_id = null where id = '${dono()}'`)).toBe('P0001');
    });
    await db.exec(`
      update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['proprietario'] where id='${U.dono2}'`);
    await como(db, dono(), async () => {
      expect(await tenta(`update agro.profiles set perfis = array['agronomico'] where id = '${dono()}'`)).toBeNull();
    });
    await db.exec(`update agro.profiles set perfis = array['proprietario'] where id = '${dono()}'`);
    await db.exec(`update agro.profiles set org_id = null, perfis = '{}' where id = '${U.dono2}'`);
  });

  it('perfil inválido é recusado pelo banco', async () => {
    expect(await tenta(`update agro.profiles set perfis = array['superadmin'] where id = '${U.campo}'`)).toBe('23514');
  });
});

describe('matriz: o banco concorda com apps/web/lib/permissoes.ts', () => {
  const combos: string[][] = [];
  for (let m = 0; m < 1 << ORDEM_PERFIS.length; m++) combos.push(ORDEM_PERFIS.filter((_, i) => m & (1 << i)));

  it(`as ${combos.length} combinações de perfis × ${TODAS_PERMISSOES.length} permissões batem`, async () => {
    const divergencias: string[] = [];
    for (const perfis of combos) {
      await db.query(`update agro.profiles set perfis = $1::text[] where id = '${U.leitura}'`, [perfis]);
      await como(db, U.leitura, async () => {
        for (const p of TODAS_PERMISSOES) {
          const { rows } = await db.query<{ ok: boolean }>('select agro.pode($1) as ok', [p]);
          if (rows[0]!.ok !== pode(perfis, p)) divergencias.push(`${perfis.join('+') || '(nenhum)'} / ${p}`);
        }
      });
    }
    await db.exec(`update agro.profiles set perfis = array['leitura'] where id = '${U.leitura}'`);
    expect(divergencias).toEqual([]);
  });

  it('produtor nunca tem permissão, mesmo com perfis gravados', async () => {
    await como(db, ID.produtorA, async () => {
      for (const p of TODAS_PERMISSOES) {
        const { rows } = await db.query<{ ok: boolean }>('select agro.pode($1) as ok', [p]);
        expect(rows[0]!.ok, p).toBe(false);
      }
    });
  });
});

describe('RLS por perfil nas tabelas', () => {
  const novoProdutor = (nome: string) => `insert into agro.produtores (org_id, nome) values ('${ID.orgA}', '${nome}')`;

  it('carteira: agronômico e campo gravam; financeiro e consulta só leem', async () => {
    await como(db, U.agro, async () => expect(await tenta(novoProdutor('ag'))).toBeNull());
    await como(db, U.campo, async () => expect(await tenta(novoProdutor('ca'))).toBeNull());
    await como(db, U.fin, async () => expect(await tenta(novoProdutor('fi'))).not.toBeNull());
    await como(db, U.leitura, async () => {
      expect(await tenta(novoProdutor('le'))).not.toBeNull();
      expect(await contar(db, `select count(*)::int n from agro.produtores`)).toBeGreaterThan(0); // leitura livre
      await tenta(`update agro.produtores set nome = 'hack' where id = '${ID.cadA}'`);
    });
    expect(await contar(db, `select count(*)::int n from agro.produtores where nome = 'hack'`)).toBe(0);
  });

  it('recomendações: só quem emite (agronômico/proprietário)', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into agro.analises (talhao_id, data_coleta) values ('${ID.talhaoA}', current_date) returning id`,
    );
    const ins = `insert into agro.recomendacoes (analise_id, motor_versao, tabelas_snapshot, resultado) values ('${rows[0]!.id}','1','{}','{}')`;
    await como(db, U.campo, async () => expect(await tenta(ins)).not.toBeNull());
    await como(db, U.agro, async () => expect(await tenta(ins)).toBeNull());
  });

  it('tabelas de referência: só agronômico/proprietário', async () => {
    const ins = (tipo: string) => `insert into agro.tabelas_referencia (org_id, tipo, conteudo) values ('${ID.orgA}', '${tipo}', '{}')`;
    await como(db, U.campo, async () => expect(await tenta(ins('faixas'))).not.toBeNull());
    await como(db, U.agro, async () => expect(await tenta(ins('faixas'))).toBeNull());
  });

  it('financeiro do escritório: quem não é do financeiro nem lê', async () => {
    await db.exec(`insert into agro.financeiro_escrit_contas (org_id, nome) values ('${ID.orgA}', 'Caixa')`);
    const ler = `select count(*)::int n from agro.financeiro_escrit_contas`;
    await como(db, U.fin, async () => expect(await contar(db, ler)).toBe(1));
    await como(db, dono(), async () => expect(await contar(db, ler)).toBe(1));
    await como(db, U.agro, async () => expect(await contar(db, ler)).toBe(0));
    await como(db, U.leitura, async () => expect(await contar(db, ler)).toBe(0));
    await como(db, U.agro, async () => {
      expect(await tenta(`insert into agro.financeiro_escrit_contas (org_id, nome) values ('${ID.orgA}', 'x')`)).not.toBeNull();
    });
    await como(db, U.fin, async () => {
      expect(await tenta(`insert into agro.financeiro_escrit_contas (org_id, nome) values ('${ID.orgA}', 'Banco')`)).toBeNull();
    });
  });

  it('convites de equipe: só o proprietário', async () => {
    const ins = `insert into agro.convites_equipe (org_id, email, perfis) values ('${ID.orgA}', 'x@y.com', array['campo'])`;
    await como(db, U.agro, async () => expect(await tenta(ins)).not.toBeNull());
    await como(db, dono(), async () => expect(await tenta(ins)).toBeNull());
    await como(db, U.agro, async () => expect(await contar(db, `select count(*)::int n from agro.convites_equipe`)).toBe(0));
  });

  it('dados do escritório e exclusão de produtor: só o proprietário', async () => {
    await como(db, U.agro, async () => {
      await tenta(`update agro.orgs set nome = 'hack' where id = '${ID.orgA}'`);
      await tenta(`delete from agro.produtores where id = '${ID.cadA2}'`);
    });
    expect(await contar(db, `select count(*)::int n from agro.orgs where nome = 'hack'`)).toBe(0);
    expect(await contar(db, `select count(*)::int n from agro.produtores where id = '${ID.cadA2}'`)).toBe(1);
    await como(db, dono(), async () => {
      await tenta(`update agro.orgs set nome = 'Org A Nova' where id = '${ID.orgA}'`);
    });
    expect(await contar(db, `select count(*)::int n from agro.orgs where nome = 'Org A Nova'`)).toBe(1);
  });
});

describe('convite de equipe com perfis e limite do plano', () => {
  const TOKEN = '71111111-0000-0000-0000-000000000001';

  it('aceitar aplica os perfis do convite', async () => {
    const id = '61111111-0000-0000-0000-0000000000b1';
    await db.exec(`
      insert into auth.users (id, email) values ('${id}','conv@t');
      insert into agro.convites_equipe (org_id, email, perfis, token) values ('${ID.orgA}', 'conv@t', array['campo','financeiro'], '${TOKEN}');
      insert into agro.assinaturas (org_id, plano, status) values ('${ID.orgA}', 'teste', 'trial') on conflict do nothing;
      update agro.planos set usuarios_max = 50 where id = 'teste'`);
    await como(db, id, async () => {
      const { rows } = await db.query<{ o: string }>(`select agro.aceitar_convite_equipe('${TOKEN}') as o`);
      expect(rows[0]!.o).toBe(ID.orgA);
    });
    const { rows } = await db.query<{ perfis: string[]; role: string; org_id: string }>(`select perfis, role, org_id from agro.profiles where id = '${id}'`);
    expect(rows[0]).toEqual({ perfis: ['campo', 'financeiro'], role: 'consultor', org_id: ID.orgA });
  });

  it('o resumo público mostra os perfis e não vaza nada além disso', async () => {
    await db.exec(`insert into agro.convites_equipe (org_id, email, perfis, token) values ('${ID.orgA}', 'z@t', array['leitura'], '71111111-0000-0000-0000-000000000002')`);
    const { rows } = await db.query<{ r: Record<string, unknown> }>(`select agro.convite_equipe_resumo('71111111-0000-0000-0000-000000000002') as r`);
    expect(rows[0]!.r).toMatchObject({ valido: true, perfis: ['leitura'], organizacao: 'Org A Nova' });
    expect(Object.keys(rows[0]!.r).sort()).toEqual(['email', 'organizacao', 'perfis', 'titulo', 'valido']);
  });

  it('plano cheio recusa o aceite', async () => {
    const id = '61111111-0000-0000-0000-0000000000b2';
    await db.exec(`
      update agro.planos set usuarios_max = 1 where id = 'teste';
      insert into auth.users (id, email) values ('${id}','cheio@t');
      insert into agro.convites_equipe (org_id, email, perfis, token) values ('${ID.orgA}', 'cheio@t', array['leitura'], '71111111-0000-0000-0000-000000000003')`);
    await como(db, id, async () => {
      expect(await tenta(`select agro.aceitar_convite_equipe('71111111-0000-0000-0000-000000000003')`)).not.toBeNull();
    });
    expect((await db.query<{ org_id: string | null }>(`select org_id from agro.profiles where id = '${id}'`)).rows[0]!.org_id).toBeNull();
  });
});

describe('remover alguém da equipe: conta desativada (0039)', () => {
  const ID_X = '61111111-0000-0000-0000-0000000000c1';
  const novoProdutor = `insert into agro.produtores (org_id, nome) values ('${ID.orgA}', 'por removido')`;

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id, email) values ('${ID_X}','x@t');
      update agro.profiles set org_id='${ID.orgA}', role='consultor', perfis=array['agronomico','campo'] where id='${ID_X}'`);
  });

  it('antes: grava normalmente', async () => {
    await como(db, ID_X, async () => expect(await tenta(novoProdutor)).toBeNull());
  });

  it('depois de desativado (como o servidor faz), o token antigo já não grava nada', async () => {
    // o servidor (service role / dono da conexão) desativa e desvincula
    await db.exec(`update agro.profiles set org_id = null, perfis = '{}', desativado_em = now() where id = '${ID_X}'`);
    // o JWT antigo ainda leva org_id (vale até expirar): por isso a prova usa o claim do escritório antigo
    await db.query("select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
      JSON.stringify({ sub: ID_X, role: 'authenticated', org_id: ID.orgA, user_role: 'consultor' }), ID_X,
    ]);
    await db.exec('set role authenticated');
    try {
      expect(await tenta(novoProdutor)).not.toBeNull();
      const { rows } = await db.query<{ ok: boolean }>("select agro.pode('carteira.editar') as ok");
      expect(rows[0]!.ok).toBe(false);
    } finally {
      await db.exec('reset role');
    }
  });

  it('o cliente não reativa a própria conta nem abre escritório de teste', async () => {
    await como(db, ID_X, async () => {
      expect(await tenta(`update agro.profiles set desativado_em = null where id = '${ID_X}'`)).toBe('42501');
      expect(await tenta(`select agro.criar_escritorio('Volta')`)).toBe('42501');
    });
    const { rows } = await db.query<{ org_id: string | null; off: boolean }>(`select org_id, desativado_em is not null as off from agro.profiles where id = '${ID_X}'`);
    expect(rows[0]).toEqual({ org_id: null, off: true });
  });

  it('proprietário não (des)ativa conta pelo cliente: só o servidor', async () => {
    await como(db, dono(), async () => {
      expect(await tenta(`update agro.profiles set desativado_em = now() where id = '${U.campo}'`)).toBe('42501');
    });
  });
});
