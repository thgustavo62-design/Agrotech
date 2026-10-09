import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { contarNaoLidas } from '@/lib/notificacoes';
import { CabecalhoConnect } from '@/components/connect/cabecalho-connect';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AgroTech Connect', description: 'Seus pedidos ao técnico, com foto, acompanhamento e resposta.' };

/** O site Connect: o produtor pede ajuda ao técnico; a equipe atende numa fila com responsável e prazo. Molde próprio, separado dos outros sites. */
export default async function LayoutConnect({ children }: { children: React.ReactNode }) {
  const { sb, perfil, bloqueio, ehEquipe } = await exigirConta('connect');
  if (bloqueio) return bloqueio;
  const naoLidas = await contarNaoLidas(sb);

  return (
    <div className="site-connect">
      <CabecalhoConnect nome={perfil.nome} ehEquipe={ehEquipe} naoLidas={naoLidas} />
      {children}
      <footer className="cn-rodape">
        <div className="cn-rodape-interno">
          <span><b>AgroTech Connect</b> · fale com o seu técnico</span>
          <span>Seus pedidos ficam registrados para você acompanhar · <Link href="/sites">Trocar de site</Link></span>
        </div>
      </footer>
    </div>
  );
}
