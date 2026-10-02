import { f } from '@/lib/formato';
import { Cartao, Vazio } from '@/components/ui';
import { salvarPropriedade } from '../../acoes';
import type { ContextoProdutor } from '../dados';

export function PainelPropriedades({ ctx }: { ctx: ContextoProdutor }) {
  const { id, talhoes, propriedades } = ctx;

  return (
    (
      <>
        {propriedades.length === 0 ? (
          <Vazio titulo="Nenhuma propriedade cadastrada" />
        ) : (
          <div className="lista" style={{ marginBottom: 14 }}>
            {propriedades.map((pr) => {
              const nTalhoes = talhoes.filter((t) => t.propriedade?.id === pr.id).length;
              return (
                <div className="item" key={pr.id}>
                  <div className="cresce">
                    <h3>{pr.nome}</h3>
                    <small>
                      {pr.municipio ?? 'município não informado'} ·{' '}
                      {pr.area_total ? `${f(Number(pr.area_total), 1)} ha declarados` : 'área não informada'} · {nTalhoes} talhão(ões)
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Cartao olho="Cadastro" titulo="Nova propriedade">
          <form action={salvarPropriedade} className="grade g2">
            <input type="hidden" name="produtor_id" value={id} />
            <div className="campo"><label htmlFor="pr_nome">Nome</label><input id="pr_nome" name="nome" required autoComplete="off" /></div>
            <div className="campo"><label htmlFor="pr_mun">Município</label><input id="pr_mun" name="municipio" autoComplete="off" /></div>
            <div className="campo"><label htmlFor="pr_uf">UF</label><input id="pr_uf" name="uf" defaultValue="ES" maxLength={2} /></div>
            <div className="campo"><label htmlFor="pr_area">Área total <span className="un">ha</span></label><input id="pr_area" name="area_total" className="mono" inputMode="decimal" /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar propriedade</button></div>
          </form>
        </Cartao>
      </>
    )
  );
}
