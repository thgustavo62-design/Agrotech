import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { hojeISO } from '@/lib/formato';
import { ROTULO_SITUACAO, contarPorMes, contarSituacao, ultimosMeses, type SituacaoTalhao } from '@/lib/painel-series';
import { Cartao } from '@/components/ui';
import { BarrasAgrupadas, Rosca, type FatiaDaRosca } from '@/components/graficos';
import { MapaPropriedadesLazy } from '@/components/mapa-propriedades-lazy';

const SERIES_MESES = 6;
const CLASSE_SITUACAO: Record<SituacaoTalhao, FatiaDaRosca['classe']> = { em_ordem: 's1', precisa_correcao: 's4', sem_analise: 's2' };

/**
 * Panorama do escritório: atividade dos últimos 6 meses (análises, visitas, recomendações), situação dos talhões e mapa das
 * propriedades. Tudo calculado dos registros reais do escritório (a RLS já limita ao próprio escritório); nada é estimado.
 */
export async function Panorama() {
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');
  const meses = ultimosMeses(hojeISO(), SERIES_MESES);
  const desde = `${meses[0]!.chave}-01`;

  const [analises, visitas, recomendacoes, situacao, propriedades] = await Promise.all([
    s.from('analises').select('data_coleta').gte('data_coleta', desde).limit(5000),
    s.from('visitas').select('data').gte('data', desde).limit(5000),
    s.from('recomendacoes').select('emitida_em').gte('emitida_em', desde).limit(5000),
    s.from('vw_talhao_situacao').select('situacao').limit(5000),
    s.from('propriedades').select('id, nome, lat, lng, produtor:produtor_id(nome)').limit(1000),
  ]);

  const nAnalises = contarPorMes(((analises.data ?? []) as Array<{ data_coleta: string | null }>).map((r) => r.data_coleta), meses);
  const nVisitas = contarPorMes(((visitas.data ?? []) as Array<{ data: string | null }>).map((r) => r.data), meses);
  const nRecs = contarPorMes(((recomendacoes.data ?? []) as Array<{ emitida_em: string | null }>).map((r) => r.emitida_em), meses);
  const totalAtividade = [...nAnalises, ...nVisitas, ...nRecs].reduce((a, b) => a + b, 0);

  const sit = contarSituacao(((situacao.data ?? []) as Array<{ situacao: string | null }>).map((r) => r.situacao));
  const totalTalhoes = sit.em_ordem + sit.precisa_correcao + sit.sem_analise;

  const props = ((propriedades.data ?? []) as unknown as Array<{ id: string; nome: string; lat: number | null; lng: number | null; produtor: { nome: string } | { nome: string }[] | null }>).map((p) => ({
    id: p.id, nome: p.nome, lat: p.lat, lng: p.lng, produtorNome: Array.isArray(p.produtor) ? (p.produtor[0]?.nome ?? null) : (p.produtor?.nome ?? null),
  }));
  const noMapa = props.filter((p) => p.lat != null && p.lng != null).length;

  const resumoAtividade = `Atividade dos últimos ${SERIES_MESES} meses: ${nAnalises.reduce((a, b) => a + b, 0)} análises, ${nVisitas.reduce((a, b) => a + b, 0)} visitas e ${nRecs.reduce((a, b) => a + b, 0)} recomendações.`;
  const fatias: FatiaDaRosca[] = (Object.keys(ROTULO_SITUACAO) as SituacaoTalhao[]).map((k) => ({ nome: ROTULO_SITUACAO[k], valor: sit[k], classe: CLASSE_SITUACAO[k] }));

  return (
    <section className="panorama" aria-label="Panorama do escritório">
      <Cartao>
        <div className="panorama-topo">
          <div><span className="olho">Últimos {SERIES_MESES} meses</span><h2>Atividade do escritório</h2></div>
          <Link href="/app/relatorios">Ver relatórios</Link>
        </div>
        {totalAtividade === 0 ? (
          <p className="panorama-vazio">Ainda não há análises, visitas ou recomendações nesse período. Quando você lançar, o gráfico aparece aqui.</p>
        ) : (
          <BarrasAgrupadas
            categorias={meses.map((m) => m.rotulo)}
            series={[
              { nome: 'Análises', valores: nAnalises, classe: 's1' },
              { nome: 'Visitas', valores: nVisitas, classe: 's2' },
              { nome: 'Recomendações', valores: nRecs, classe: 's3' },
            ]}
            resumo={resumoAtividade}
          />
        )}
      </Cartao>

      <Cartao>
        <div className="panorama-topo">
          <div><span className="olho">Carteira</span><h2>Situação dos talhões</h2></div>
          <Link href="/app/talhoes">Ver talhões</Link>
        </div>
        {totalTalhoes === 0 ? (
          <p className="panorama-vazio">Nenhum talhão cadastrado ainda.</p>
        ) : (
          <Rosca
            fatias={fatias}
            rotuloCentro="talhões"
            resumo={`Situação dos ${totalTalhoes} talhões: ${sit.em_ordem} em ordem, ${sit.precisa_correcao} precisam de correção e ${sit.sem_analise} sem análise recente.`}
          />
        )}
      </Cartao>

      <Cartao className="panorama-largo">
        <div className="panorama-topo">
          <div><span className="olho">Território</span><h2>Propriedades no mapa</h2></div>
          <Link href="/app/propriedades">{noMapa} de {props.length} com localização</Link>
        </div>
        <div className="panorama-mapa">
          <MapaPropriedadesLazy propriedades={props} altura={320} />
        </div>
      </Cartao>
    </section>
  );
}
