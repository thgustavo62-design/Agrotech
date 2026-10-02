'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { IconeAssinatura, IconeCadeado, IconeEquipe, IconeProdutores, IconePropriedades } from '@/components/icones';
import { hrefAtivo } from '@/lib/navegacao';

interface Secao {
  href: string;
  rotulo: string;
  ajuda: string;
  icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** só aparece para quem administra o plano */
  soPlano?: boolean;
}

const SECOES: Secao[] = [
  { href: '/app/config', rotulo: 'Meu perfil', ajuda: 'Nome, CREA, senha', icone: IconeProdutores },
  { href: '/app/config/escritorio', rotulo: 'Escritório', ajuda: 'Nome e localização', icone: IconePropriedades },
  { href: '/app/config/equipe', rotulo: 'Equipe e permissões', ajuda: 'Quem acessa e o que pode', icone: IconeEquipe },
  { href: '/app/assinatura', rotulo: 'Plano e cobrança', ajuda: 'Limites e pagamento', icone: IconeAssinatura, soPlano: true },
  { href: '/app/config/privacidade', rotulo: 'Privacidade e dados', ajuda: 'LGPD e atividade', icone: IconeCadeado },
];

/**
 * Menu da central de configurações: coluna fixa ao lado do conteúdo no computador; no celular vira uma
 * faixa de abas que rola na horizontal (padrão de painéis de SaaS — o conteúdo ocupa a tela toda).
 */
export function SubNavConfig({ verPlano }: { verPlano: boolean }) {
  const path = usePathname();
  const secoes = SECOES.filter((s) => !s.soPlano || verPlano);
  const atual = hrefAtivo(path, secoes.map((s) => s.href));

  return (
    <nav className="cfg-nav nao-imprime" aria-label="Seções das configurações">
      {secoes.map((s) => {
        const Icone = s.icone;
        const ativa = s.href === atual;
        return (
          <Link key={s.href} href={s.href} className="cfg-nav-item" data-ativa={ativa} aria-current={ativa ? 'page' : undefined}>
            <Icone width={18} height={18} />
            <span>
              <b>{s.rotulo}</b>
              <small>{s.ajuda}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
