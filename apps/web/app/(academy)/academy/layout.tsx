import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { pode } from '@/lib/permissoes';
import { CabecalhoAcademy } from '@/components/academy/cabecalho-academy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AgroTech Academy', description: 'Cursos, aulas e certificados do seu escritório de assistência técnica.' };

/** O site da Academy: molde próprio (barra no topo, vitrine de cursos), separado da Assistência Técnica. */
export default async function LayoutAcademy({ children }: { children: React.ReactNode }) {
  const { perfil, bloqueio, ehAluno, ehEquipe } = await exigirConta('academy');
  if (bloqueio) return bloqueio;
  const ehEstudio = ehEquipe && (pode(perfil.perfis, 'academy.gerenciar') || pode(perfil.perfis, 'academy.indicar'));

  return (
    <div className="site-academy">
      <CabecalhoAcademy nome={perfil.nome} ehAluno={ehAluno} ehEstudio={ehEstudio} />
      {children}
      <footer className="ac-rodape">
        <div className="ac-rodape-interno">
          <span><b>AgroTech Academy</b> · aprender no seu ritmo</span>
          <span>Certificado de participação do escritório · <Link href="/sites">Trocar de site</Link></span>
        </div>
      </footer>
    </div>
  );
}
