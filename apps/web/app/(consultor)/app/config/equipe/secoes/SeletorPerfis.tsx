import { ORDEM_PERFIS, PERFIS } from '@/lib/permissoes';

/**
 * Escolha de perfis (combináveis) em forma de cartões com checkbox — funciona sem JavaScript, e cada
 * opção diz em linguagem de campo o que a pessoa poderá fazer. `idBase` evita id repetido na página.
 */
export function SeletorPerfis({ idBase, marcados }: { idBase: string; marcados: readonly string[] }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="so-leitor">Perfis de acesso</legend>
      <div className="perfis-opcoes">
        {ORDEM_PERFIS.map((id) => {
          const p = PERFIS[id];
          return (
            <label key={id} className="perfil-opcao" htmlFor={`${idBase}-${id}`}>
              <input id={`${idBase}-${id}`} type="checkbox" name="perfis" value={id} defaultChecked={marcados.includes(id)} />
              <span>
                <b>{p.nome}{id === 'proprietario' ? <span className="tag alerta">acesso total</span> : null}</b>
                <small>{p.para} {p.pode.slice(0, 2).join('; ')}.</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
