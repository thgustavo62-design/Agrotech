import { Cartao } from '@/components/ui';
import { MATRIZ, ORDEM_PERFIS, PERFIS, pode } from '@/lib/permissoes';

/** O que cada perfil pode — gerada de lib/permissoes.ts (a mesma regra que o banco aplica), nunca digitada à mão. */
export function SecaoMatriz() {
  return (
    <Cartao olho="Referência" titulo="O que cada perfil pode fazer">
      <p className="nota" style={{ margin: '0 0 12px' }}>
        Os perfis se somam: quem tem “Campo” e “Financeiro” faz as duas coisas. Sem perfil nenhum, a pessoa não acessa nada.
      </p>
      <div className="rolagem">
        <table className="matriz sem-rolagem">
          <thead>
            <tr>
              <th scope="col">Ação</th>
              {ORDEM_PERFIS.map((id) => <th scope="col" key={id}>{PERFIS[id].nome.split(' / ')[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {MATRIZ.map((g) => (
              <MatrizGrupo key={g.grupo} grupo={g} />
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function MatrizGrupo({ grupo }: { grupo: (typeof MATRIZ)[number] }) {
  return (
    <>
      <tr className="grupo"><th colSpan={ORDEM_PERFIS.length + 1}>{grupo.grupo}</th></tr>
      {grupo.itens.map((i) => (
        <tr key={i.permissao}>
          <td>{i.rotulo}</td>
          {ORDEM_PERFIS.map((id) => {
            const sim = pode([id], i.permissao);
            return (
              <td key={id} className={sim ? 'sim' : 'nao'}>
                <span aria-hidden="true">{sim ? '✓' : '–'}</span>
                <span className="so-leitor">{sim ? 'pode' : 'não pode'}</span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
