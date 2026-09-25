import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { calcular } from '@agrotech/agro-core';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura, paraAnalise } from '@/lib/culturas';
import { Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CAFE } from '@/components/banner-hero';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; data_coleta: string;
  argila: number | null; ph: number | null; mo: number | null; p: number | null; k: number | null;
  na: number | null; ca: number | null; mg: number | null; al: number | null; h_al: number | null;
  talhao: { nome: string | null; cultura: string | null } | null;
};

export default async function ListaAnalises({
  searchParams,
}: {
  searchParams: Promise<{ cultura?: string }>;
}) {
  const { cultura: filtro } = await searchParams;
  const sb = await criarClienteServidor();
  const [{ data }, tabelas] = await Promise.all([
    sb.schema('agro').from('analises')
      .select('id, data_coleta, argila, ph, mo, p, k, na, ca, mg, al, h_al, talhao:talhao_id(nome, cultura)')
      .is('arquivado_em', null)
      .order('data_coleta', { ascending: false }),
    tabelasDaOrg(sb),
  ]);

  const todas = (data ?? []) as unknown as Row[];
  const culturasPresentes = [...new Set(todas.map((a) => a.talhao?.cultura ?? '__sem'))]
    .sort((a, b) => nomeCultura(a).localeCompare(nomeCultura(b)));
  const analises = filtro ? todas.filter((a) => (a.talhao?.cultura ?? '__sem') === filtro) : todas;

  return (
    <>
      <BannerHero imagem={FOTO_CAFE}
        olho="Fertilidade"
        titulo="Análises de solo"
        descricao="Lance o laudo e o AgroTech interpreta, calcula calagem e monta a adubação."
        tags={['Solo', 'Fertilidade', 'Precisão']}
        acoes={<Link className="btn verde" href="/app/analises/nova">Lançar análise</Link>}
      />

      {culturasPresentes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Link className="aba" data-ativa={!filtro} href="/app/analises">Todas</Link>
          {culturasPresentes.map((c) => (
            <Link key={c} className="aba" data-ativa={filtro === c} href={`/app/analises?cultura=${encodeURIComponent(c)}`}>
              {nomeCultura(c === '__sem' ? null : c)}
            </Link>
          ))}
        </div>
      )}

      {analises.length === 0 ? (
        <Vazio titulo="Nenhuma análise">
          {filtro ? 'Nenhuma análise nesta cultura.' : 'Você precisa de um talhão cadastrado para lançar a primeira.'}{' '}
          <Link href="/demo">Ver a vitrine da interpretação.</Link>
        </Vazio>
      ) : (
        <div className="lista">
          {analises.map((a) => {
            const cult = a.talhao?.cultura ? tabelas.culturas[a.talhao.cultura] : undefined;
            const r = calcular(paraAnalise(a), tabelas);
            const okV = r.V >= (cult?.V2 ?? 60);
            return (
              <div className="item" key={a.id}>
                <div className="cresce">
                  <h3>{a.talhao?.nome ?? 'Talhão removido'} — {dataBR(a.data_coleta)}</h3>
                  <small className="mono">
                    {nomeCultura(a.talhao?.cultura ?? null)} · pH {f(Number(a.ph ?? 0), 1)} · V {f(r.V, 0)}% · m {f(r.m, 0)}% · CTC {f(r.T, 1)}
                  </small>
                </div>
                <Tag tom={okV ? 'ok' : 'ruim'}>V {f(r.V, 0)}%</Tag>
                <Link className="btn mini" href={`/app/analises/${a.id}`}>Interpretar</Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
