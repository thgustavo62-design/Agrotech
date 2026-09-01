import Link from 'next/link';
import { salvarProdutor } from '@/app/(consultor)/app/produtores/acoes';

type Produtor = {
  id?: string;
  nome?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  fone?: string | null;
};

export function FormProdutor({ produtor }: { produtor?: Produtor }) {
  const p = produtor ?? {};
  return (
    <form action={salvarProdutor} className="cartao">
      {p.id ? <input type="hidden" name="id" value={p.id} /> : null}
      <div className="grade g2">
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="nome">Nome do produtor</label>
          <input id="nome" name="nome" defaultValue={p.nome ?? ''} required autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="cpf_cnpj">CPF / CNPJ</label>
          <input id="cpf_cnpj" name="cpf_cnpj" defaultValue={p.cpf_cnpj ?? ''} autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="fone">Telefone</label>
          <input id="fone" name="fone" defaultValue={p.fone ?? ''} autoComplete="off" />
        </div>
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={p.email ?? ''} autoComplete="off" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn verde" type="submit">Salvar</button>
        <Link className="btn sec" href={p.id ? `/app/produtores/${p.id}` : '/app/produtores'}>Cancelar</Link>
      </div>
    </form>
  );
}
