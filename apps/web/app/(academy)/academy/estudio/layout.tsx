import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirConta } from '@/lib/guarda-de-site';
import { AbasDoEstudio } from './abas';

export const dynamic = 'force-dynamic';

/** O Estúdio é da equipe do escritório: quem monta os cursos, as aulas e as indicações. O aluno nunca chega aqui. */
export default async function LayoutDoEstudio({ children }: { children: React.ReactNode }) {
  const { ehEquipe } = await exigirConta('academy');
  if (!ehEquipe) redirect('/academy');
  return (
    <main className="ac-principal">
      <p className="ac-migalha ac-migalha-clara"><Link href="/academy">Academy</Link> / Estúdio</p>
      <AbasDoEstudio />
      {children}
    </main>
  );
}
