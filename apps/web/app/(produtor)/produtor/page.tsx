import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export default async function PainelProdutor() {
  const sb = await criarClienteServidor();

  const [{ data: talhoes }, { data: recs }] = await Promise.all([
    sb.schema('agro').from('vw_talhao_situacao')
      .select('talhao_id, nome, cultura, area_ha, data_coleta, situacao')
      .order('nome'),
    sb.schema('agro').from('recomendacoes')
      .select('id, emitida_em, analise:analise_id(talhao:talhao_id(nome, cultura))')
      .is('arquivada_em', null)
      .order('emitida_em', { ascending: false })
      .limit(1),
  ]);

  const lista = (talhoes ?? []) as Array<{
    talhao_id: string; nome: string; cultura: string | null;
    area_ha: number | null; data_coleta: string | null; situacao: string;
  }>;
  // deno-lint-ignore no-explicit-any
  const ultima = (recs ?? [])[0] as any;
  const precisam = lista.filter((t) => t.situacao === 'precisa_correcao').length;

  return (
    <>
      <CabecalhoVista
        olho="Sua lavoura"
        titulo="Meus talhões"
        descricao="O estado de cada área conforme a análise de solo mais recente que o seu técnico lançou."
      />

      {ultima && (
        <Cartao olho="Novidade" titulo="Última recomendação recebida">
          <p style={{ margin: 0 }}>
            {nomeCultura(ultima.analise?.talhao?.cultura ?? null)} — {ultima.analise?.talhao?.nome ?? 'talhão'}
            {' · '}<span className="nota">{dataBR(String(ultima.emitida_em).slice(0, 10))}</span>
          </p>
          <Link className="btn verde mini" href={`/produtor/laudos/${ultima.id}`} style={{ marginTop: 10 }}>
            Abrir o laudo completo
          </Link>
        </Cartao>
      )}

      <Cartao
        olho="Situação"
        titulo={precisam > 0 ? `${precisam} talhão(ões) pedem atenção` : 'Nenhum talhão pedindo correção'}
      >
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum talhão cadastrado">Fale com o seu técnico.</Vazio>
        ) : (
          <div className="lista">
            {lista.map((t) => {
              const e = ESTADO[t.situacao] ?? ESTADO.sem_analise!;
              return (
                <div className="item" key={t.talhao_id}>
                  <div className="cresce">
                    <h3>{t.nome}</h3>
                    <small>
                      {nomeCultura(t.cultura)} · {f(Number(t.area_ha ?? 0), 1)} ha
                      {t.data_coleta ? ` · análise de ${dataBR(t.data_coleta)}` : ''}
                    </small>
                  </div>
                  <Tag tom={e.tom}>{e.txt}</Tag>
                </div>
              );
            })}
          </div>
        )}
        <p className="nota" style={{ marginTop: 12 }}>
          &ldquo;Precisa de correção&rdquo; significa que a saturação por bases está baixa ou o alumínio
          alto na última análise. Os números técnicos estão no laudo.
        </p>
      </Cartao>
    </>
  );
}
