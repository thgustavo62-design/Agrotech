import { criarClienteServidor } from '@/lib/supabase/server';
import { f } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Grade, Metrica, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Talhao = { id: string; nome: string; cultura: string | null; area_ha: number | null };
type Propriedade = {
  id: string; nome: string; municipio: string | null; uf: string | null; area_total: number | null;
  talhoes: Talhao[];
};

export default async function FazendaProdutor() {
  const sb = await criarClienteServidor();

  const { data } = await sb
    .schema('agro')
    .from('propriedades')
    .select('id, nome, municipio, uf, area_total, talhoes:talhoes(id, nome, cultura, area_ha)')
    .order('nome');

  const propriedades = (data ?? []) as unknown as Propriedade[];
  const todosTalhoes = propriedades.flatMap((p) => p.talhoes);
  const areaTalhoes = todosTalhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const culturas = [...new Set(todosTalhoes.map((t) => t.cultura).filter((c): c is string => Boolean(c)))];

  return (
    <>
      <CabecalhoVista
        olho="Sua lavoura"
        titulo="Minha fazenda"
        descricao="Suas propriedades e os talhões de cada uma."
      />

      <Grade cols={3}>
        <Metrica rotulo="Propriedades" valor={propriedades.length} />
        <Metrica rotulo="Área com talhão" valor={`${f(areaTalhoes, 1)} ha`} />
        <Metrica rotulo="Culturas" valor={culturas.length} detalhe={culturas.map((c) => nomeCultura(c)).join(', ') || undefined} />
      </Grade>

      {propriedades.length === 0 ? (
        <Vazio titulo="Nenhuma propriedade cadastrada ainda">Fale com o seu técnico.</Vazio>
      ) : (
        propriedades.map((pr) => (
          <Cartao
            key={pr.id}
            olho={[pr.municipio, pr.uf].filter(Boolean).join('/') || 'Município não informado'}
            titulo={pr.nome}
            style={{ marginTop: 14 }}
          >
            <p className="nota" style={{ margin: '0 0 10px' }}>
              {pr.area_total ? `${f(Number(pr.area_total), 1)} ha declarados` : 'Área total não informada'}
              {' · '}{pr.talhoes.length} talhão(ões)
            </p>
            {pr.talhoes.length === 0 ? (
              <Vazio titulo="Nenhum talhão cadastrado nesta propriedade" />
            ) : (
              <div className="lista">
                {pr.talhoes.map((t) => (
                  <div className="item" key={t.id}>
                    <div className="cresce">
                      <h3>{t.nome}</h3>
                      <small>{nomeCultura(t.cultura)}</small>
                    </div>
                    <span className="mono nota">{f(Number(t.area_ha ?? 0), 1)} ha</span>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        ))
      )}
    </>
  );
}
