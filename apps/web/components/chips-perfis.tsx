import { PERFIS, perfisValidos } from '@/lib/permissoes';

/** Os perfis de uma pessoa como etiquetas. Proprietário em destaque; sem perfil, um aviso. */
export function ChipsPerfis({ perfis }: { perfis: readonly string[] | null | undefined }) {
  const lista = perfisValidos(perfis ?? []);
  if (!lista.length) return <div className="chips"><span className="tag alerta">Sem perfil de acesso</span></div>;
  return (
    <div className="chips">
      {lista.map((id) => (
        <span key={id} className={id === 'proprietario' ? 'tag' : 'tag cinza'}>{PERFIS[id].nome}</span>
      ))}
    </div>
  );
}
