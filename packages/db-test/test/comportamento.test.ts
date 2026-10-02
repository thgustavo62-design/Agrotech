import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bancoMigrado, como, contar, codigoDeErro, semear, ID } from './banco';

let db: PGlite;
let falhas: Awaited<ReturnType<typeof bancoMigrado>>['falhas'];

beforeAll(async () => {
  ({ db, falhas } = await bancoMigrado());
  await semear(db);
});

describe('migrations', () => {
  it('todas aplicam num Postgres limpo', () => {
    expect(falhas).toEqual([]);
  });
});

describe('isolamento por organização e por produtor', () => {
  it('consultor só enxerga a própria carteira', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.talhoes')).toBe(2);
    });
    await como(db, ID.consultorB, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.talhoes')).toBe(1);
    });
  });

  it('produtor enxerga só o próprio talhão, mesmo com outro produtor na mesma org', async () => {
    await como(db, ID.produtorA, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.talhoes')).toBe(1);
      expect(await contar(db, `select count(*)::int n from agro.talhoes where id = '${ID.talhaoA2}'`)).toBe(0);
    });
  });
});

describe('filtro por produtor (painel do produtor)', () => {
  it('talhões, propriedades e visitas têm produtor_id e o filtro isola cada produtor do escritório', async () => {
    await db.exec(`insert into agro.visitas (id, talhao_id, data) values ('a4000000-0000-0000-0000-0000000000a1','${ID.talhaoA2}','2026-09-01')`);
    await como(db, ID.consultorA, async () => {
      const por = (tabela: string, cad: string) => contar(db, `select count(*)::int n from agro.${tabela} where produtor_id = '${cad}'`);
      // o consultor A enxerga os dois produtores, mas cada filtro devolve só os do produtor pedido
      expect(await por('talhoes', ID.cadA)).toBe(1);
      expect(await por('talhoes', ID.cadA2)).toBe(1);
      expect(await por('propriedades', ID.cadA)).toBe(1);
      expect(await por('visitas', ID.cadA2)).toBe(1);
      expect(await por('visitas', ID.cadA)).toBe(0);
    });
  });
});

describe('visita — idempotência do reenvio offline (0031)', () => {
  const chave = 'cccccccc-0000-0000-0000-000000000001';
  const inserir = `insert into agro.visitas (talhao_id, data, chave_cliente) values ('${ID.talhaoA}','2026-09-30',$1)`;

  it('mesma chave_cliente falha com 23505; sem chave pode repetir', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, inserir, [chave])).toBeNull();
      expect(await codigoDeErro(db, inserir, [chave])).toBe('23505');
      expect(await codigoDeErro(db, `insert into agro.visitas (talhao_id, data) values ('${ID.talhaoA}','2026-10-01'),('${ID.talhaoA}','2026-10-02')`)).toBeNull();
    });
  });

  it('a visita herda a org do talhão e aceita foto com lat/lng', async () => {
    await como(db, ID.consultorA, async () => {
      const { rows } = await db.query<{ id: string; org_id: string }>('select id, org_id from agro.visitas where chave_cliente = $1', [chave]);
      expect(rows[0]!.org_id).toBe(ID.orgA);
      const erro = await codigoDeErro(
        db,
        "insert into agro.visita_fotos (visita_id, storage_path, lat, lng) values ($1, 'x/y.jpg', -19.123456, -40.654321)",
        [rows[0]!.id],
      );
      expect(erro).toBeNull();
    });
  });

  it('outro consultor não vê as visitas', async () => {
    await como(db, ID.consultorB, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.visitas')).toBe(0);
    });
  });
});

describe('tabelas de referência — upsert do editor', () => {
  const upsert =
    "insert into agro.tabelas_referencia (org_id, tipo, conteudo, versao) values ($1,'culturas',$2,$3) " +
    'on conflict (org_id, tipo) do update set conteudo = excluded.conteudo, versao = excluded.versao';

  it('consultor insere e depois atualiza a própria org (versão sobe)', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, upsert, [ID.orgA, JSON.stringify({ v: 1 }), 1])).toBeNull();
      expect(await codigoDeErro(db, upsert, [ID.orgA, JSON.stringify({ v: 2 }), 2])).toBeNull();
      const { rows } = await db.query<{ versao: number }>("select versao from agro.tabelas_referencia where org_id = $1 and tipo = 'culturas'", [ID.orgA]);
      expect(rows).toEqual([{ versao: 2 }]);
    });
  });

  it('não grava em outra org, e produtor não grava', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, upsert, [ID.orgB, '{}', 1])).not.toBeNull();
    });
    await como(db, ID.produtorA, async () => {
      expect(await codigoDeErro(db, upsert, [ID.orgA, '{}', 9])).not.toBeNull();
    });
  });
});

describe('notificação de nova recomendação (0024)', () => {
  it('só o produtor dono da análise recebe', async () => {
    await db.exec(`insert into agro.analises (id, talhao_id, data_coleta) values ('a3000000-0000-0000-0000-000000000000','${ID.talhaoA}','2026-09-01')`);
    await como(db, ID.consultorA, async () => {
      const erro = await codigoDeErro(
        db,
        "insert into agro.recomendacoes (analise_id, motor_versao, tabelas_snapshot, resultado) values ('a3000000-0000-0000-0000-000000000000','0.1.0','{}','{}')",
      );
      expect(erro).toBeNull();
    });
    await como(db, ID.produtorA, async () => {
      const { rows } = await db.query<{ tipo: string }>('select tipo from agro.notificacoes');
      expect(rows.map((r) => r.tipo)).toEqual(['nova_recomendacao']);
    });
    await como(db, ID.produtorA2, async () => {
      expect(await contar(db, 'select count(*)::int n from agro.notificacoes')).toBe(0);
    });
  });
});

describe('laudo com várias amostras (0033)', () => {
  const DOC = 'd0000000-0000-0000-0000-000000000001';
  const analise = (indice: number | null) =>
    `insert into agro.analises (talhao_id, documento_id, origem, data_coleta, amostra_indice)
     values ('${ID.talhaoA2}','${DOC}','pdf','2026-06-10',${indice})`;

  it('cada amostra do documento vira uma análise; a mesma amostra duas vezes é recusada (23505)', async () => {
    await db.exec(
      `insert into agro.documentos (id, org_id, storage_path, nome_arquivo, hash_sha256, status)
       values ('${DOC}','${ID.orgA}','${ID.orgA}/_/x.pdf','x.pdf','abc','revisao')`,
    );
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, analise(1))).toBeNull();
      expect(await codigoDeErro(db, analise(2))).toBeNull();
      expect(await codigoDeErro(db, analise(2))).toBe('23505');
      expect(await contar(db, `select count(*)::int n from agro.analises where documento_id = '${DOC}'`)).toBe(2);
    });
  });

  it('laudo de uma amostra só (índice nulo) não é afetado pelo índice único', async () => {
    await como(db, ID.consultorA, async () => {
      expect(await codigoDeErro(db, analise(null))).toBeNull();
      expect(await codigoDeErro(db, analise(null))).toBeNull();
    });
  });
});

describe('exclusão LGPD', () => {
  it('apagar o produtor leva talhões e visitas; apagar a conta leva profile e notificações', async () => {
    await db.exec(`delete from agro.produtores where id = '${ID.cadA}'`);
    expect(await contar(db, `select count(*)::int n from agro.talhoes where id = '${ID.talhaoA}'`)).toBe(0);
    expect(await contar(db, "select count(*)::int n from agro.visitas where chave_cliente = 'cccccccc-0000-0000-0000-000000000001'")).toBe(0);

    await db.exec(`delete from auth.users where id = '${ID.produtorA}'`);
    expect(await contar(db, `select count(*)::int n from agro.profiles where id = '${ID.produtorA}'`)).toBe(0);
    expect(await contar(db, `select count(*)::int n from agro.notificacoes where destinatario_user_id = '${ID.produtorA}'`)).toBe(0);
  });
});
