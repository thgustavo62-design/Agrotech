/**
 * Marca AgroTech — folha em duas tonalidades de verde com nervuras, substitui
 * o antigo quadrado rotacionado (`::before` de `.marca`). Sem dependência de
 * gradiente SVG (evita colisão de id quando aparece mais de uma vez na
 * página) — o efeito de profundidade vem de dois preenchimentos sólidos.
 * Usado tanto em componentes cliente/servidor quanto dentro de `ImageResponse`
 * (favicon/apple-icon/ícones PWA), por isso é uma função pura sem hooks.
 */
export function LogoMarca({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 4 C26 10 10 34 10 58 C10 82 28 96 50 96 Z" fill="#1a9c6d" />
      <path d="M50 4 C74 10 90 34 90 58 C90 82 72 96 50 96 Z" fill="#0b4834" />
      <path d="M50 10 L50 92" stroke="#eef1ec" strokeWidth={2.5} opacity={0.5} strokeLinecap="round" />
      <path d="M50 30 L28 44" stroke="#eef1ec" strokeWidth={1.8} opacity={0.35} strokeLinecap="round" />
      <path d="M50 30 L72 44" stroke="#eef1ec" strokeWidth={1.8} opacity={0.35} strokeLinecap="round" />
      <path d="M50 56 L30 70" stroke="#eef1ec" strokeWidth={1.8} opacity={0.35} strokeLinecap="round" />
      <path d="M50 56 L70 70" stroke="#eef1ec" strokeWidth={1.8} opacity={0.35} strokeLinecap="round" />
    </svg>
  );
}
