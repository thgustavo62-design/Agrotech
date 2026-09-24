/** Avatar circular com iniciais — sem upload de foto nesta rodada (fica pra quando fizer falta). */
export function AvatarUsuario({ nome }: { nome: string | null | undefined }) {
  const iniciais = (nome ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return <div className="avatar" aria-hidden="true">{iniciais}</div>;
}
