import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

export default async function TalhoesProdutor() {
  const sb = await criarClienteServidor();

  const { data } = await sb
    .schema('agro')
    .from('vw_talhao_situacao')
    .select('talhao_id, nome, cultura, area_ha, data_coleta, situacao')
    .order('nome');

  const talhoes = (data ?? []) as Array<{
    talhao_id: string; nome: string; cultura: string | null;
    area_ha: number | null; data_coleta: string | null; situacao: string;
  }>;

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo="Meus talhões"
        tags={['Talhões', 'Solo', 'Situação']}
        descricao="Todos os talhões que o seu técnico acompanha, com a situação da última análise de solo."
      />

      <Cartao olho={`${talhoes.length} talhão(ões)`} titulo="Situação atual">
        {talhoes.length === 0 ? (
          <Vazio titulo="Nenhum talhão cadastrado" />
        ) : (
          <div className="lista">
            {talhoes.map((t) => {
              const e = ESTADO[t.situacao] ?? ESTADO.sem_analise!;
              return (
                <div className="item" key={t.talhao_id}>
                  <div className="cresce">
                    <h3>{t.nome}</h3>
                    <small>
                      {nomeCultura(t.cultura)} · {f(Number(t.area_ha ?? 0), 1)} ha
                      {t.data_coleta ? ` · última análise em ${dataBR(t.data_coleta)}` : ''}
                    </small>
                  </div>
                  <Tag tom={e.tom}>{e.txt}</Tag>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
