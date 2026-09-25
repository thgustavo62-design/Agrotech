import Image from 'next/image';

/**
 * Ícone real da marca (logo enviada pelo Gustavo) — recortado e com fundo
 * removido (extração automática por canal alpha a partir do PNG original,
 * ver docs/PROGRESSO.md). Usado em todo canto que renderiza no navegador
 * (barras de topo, vitrine de login). proporção real ~320x283.
 */
export function LogoIcone({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <Image
      src="/logo-icone.png"
      alt=""
      width={tamanho}
      height={Math.round(tamanho * (283 / 320))}
      style={{ flexShrink: 0, objectFit: 'contain' }}
    />
  );
}
