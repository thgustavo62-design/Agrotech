import Link from 'next/link';
import { CULTURAS, nomeCultura } from '@/lib/culturas';
import { salvarTalhao } from '@/app/(consultor)/app/produtores/acoes';

type Talhao = {
  id: string;
  nome: string | null;
  cultura: string | null;
  variedade: string | null;
  area_ha: number | null;
  prod_esperada: number | null;
  espacamento: string | null;
  ano_implantacao: number | null;
  obs: string | null;
};

export function FormTalhao({ talhao, produtorId }: { talhao: Talhao; produtorId: string }) {
  return (
    <form action={salvarTalhao} className="cartao">
      <input type="hidden" name="id" value={talhao.id} />
      <input type="hidden" name="produtor_id" value={produtorId} />
      <div className="grade g2">
        <div className="campo">
          <label htmlFor="nome">Nome do talhão</label>
          <input id="nome" name="nome" defaultValue={talhao.nome ?? ''} required autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="cultura">Cultura</label>
          <select id="cultura" name="cultura" defaultValue={talhao.cultura ?? ''} required>
            <option value="" disabled>selecione…</option>
            {CULTURAS.map((c) => <option key={c} value={c}>{nomeCultura(c)}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="variedade">Variedade</label>
          <input id="variedade" name="variedade" defaultValue={talhao.variedade ?? ''} autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="area_ha">Área <span className="un">ha</span></label>
          <input id="area_ha" name="area_ha" className="mono" inputMode="decimal" defaultValue={talhao.area_ha ?? ''} />
        </div>
        <div className="campo">
          <label htmlFor="prod_esperada">Produtividade esperada</label>
          <input id="prod_esperada" name="prod_esperada" className="mono" inputMode="decimal" defaultValue={talhao.prod_esperada ?? ''} />
        </div>
        <div className="campo">
          <label htmlFor="espacamento">Espaçamento</label>
          <input id="espacamento" name="espacamento" defaultValue={talhao.espacamento ?? ''} placeholder="3,0 × 1,2 m" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="ano_implantacao">Ano de implantação</label>
          <input id="ano_implantacao" name="ano_implantacao" className="mono" inputMode="numeric" defaultValue={talhao.ano_implantacao ?? ''} />
        </div>
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="obs">Observações</label>
          <textarea id="obs" name="obs" defaultValue={talhao.obs ?? ''} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn verde" type="submit">Salvar</button>
        <Link className="btn sec" href={`/app/produtores/${produtorId}`}>Cancelar</Link>
      </div>
    </form>
  );
}
