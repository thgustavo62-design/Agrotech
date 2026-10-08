import { describe, expect, it } from 'vitest';
import { listarPasta, removerArquivosDoProdutor, type ArmazenamentoAdmin } from './lgpd-arquivos';

/** Storage falso: guarda "arquivos" por bucket e pasta; pode falhar a remoção de um bucket. */
function falso(arquivos: Record<string, string[]>, falhaEm?: string): ArmazenamentoAdmin & { restantes: () => Record<string, string[]> } {
  const estado: Record<string, string[]> = JSON.parse(JSON.stringify(arquivos));
  return {
    restantes: () => estado,
    storage: {
      from: (bucket: string) => ({
        async list(pasta: string, { limit, offset }: { limit: number; offset: number }) {
          const dentro = (estado[bucket] ?? []).filter((c) => c.startsWith(pasta + '/') && !c.slice(pasta.length + 1).includes('/'));
          const fatia = dentro.slice(offset, offset + limit).map((c) => ({ name: c.slice(pasta.length + 1), id: 'x' }));
          return { data: fatia, error: null };
        },
        async remove(caminhos: string[]) {
          if (bucket === falhaEm) return { data: null, error: { message: 'storage fora do ar' } };
          estado[bucket] = (estado[bucket] ?? []).filter((c) => !caminhos.includes(c));
          return { data: caminhos, error: null };
        },
      }),
    },
  };
}

const ORG = 'org1', P = 'prod1', OUTRO = 'prod2';

describe('removerArquivosDoProdutor', () => {
  const base = {
    laudos: [`${ORG}/${P}/a.pdf`, `${ORG}/${P}/b.pdf`, `${ORG}/${OUTRO}/c.pdf`],
    recomendacoes: [`${ORG}/${P}/r.pdf`],
    financeiro: [`${P}/nota.jpg`, `${OUTRO}/outra.jpg`],
    visitas: [`${ORG}/v1/f1.jpg`, `${ORG}/v1/f2.jpg`, `${ORG}/v9/de-outro.jpg`],
  };

  it('apaga os arquivos do produtor nos quatro lugares e NÃO toca nos dos outros', async () => {
    const s = falso(base);
    const r = await removerArquivosDoProdutor(s, { orgId: ORG, produtorId: P, fotosDeVisitas: [`${ORG}/v1/f1.jpg`, `${ORG}/v1/f2.jpg`] });
    expect(r).toMatchObject({ removidos: 6, falhas: 0 });
    expect(s.restantes()).toEqual({
      laudos: [`${ORG}/${OUTRO}/c.pdf`],
      recomendacoes: [],
      financeiro: [`${OUTRO}/outra.jpg`],
      visitas: [`${ORG}/v9/de-outro.jpg`],
    });
  });

  it('pagina pastas grandes (mais de 100 arquivos)', async () => {
    const muitos = Array.from({ length: 230 }, (_, i) => `${ORG}/${P}/f${i}.pdf`);
    const s = falso({ laudos: muitos });
    expect((await listarPasta(s, 'laudos', `${ORG}/${P}`)).caminhos).toHaveLength(230);
    const r = await removerArquivosDoProdutor(s, { orgId: ORG, produtorId: P, fotosDeVisitas: [] });
    expect(r.removidos).toBe(230);
    expect(s.restantes().laudos).toEqual([]);
  });

  it('falha de um bucket é contada e relatada, e os outros seguem', async () => {
    const s = falso(base, 'laudos');
    const r = await removerArquivosDoProdutor(s, { orgId: ORG, produtorId: P, fotosDeVisitas: [] });
    expect(r.falhas).toBe(2);
    expect(r.detalhes.join(' ')).toMatch(/laudos: storage fora do ar/);
    expect(s.restantes().recomendacoes).toEqual([]);
    expect(s.restantes().laudos).toHaveLength(3);
  });

  it('sem escritório conhecido só toca o que não depende dele', async () => {
    const s = falso(base);
    const r = await removerArquivosDoProdutor(s, { orgId: null, produtorId: P, fotosDeVisitas: [] });
    expect(r.removidos).toBe(1); // só financeiro/{produtor}
    expect(s.restantes().laudos).toHaveLength(3);
  });
});
