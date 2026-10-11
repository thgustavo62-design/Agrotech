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
      <footer className="ac-rodape ac-rodape-completo">
        <div className="ac-rodape-colunas">
          <div className="ac-rodape-sobre">
            <b>AgroTech Academy</b>
            <p>A universidade do seu escritório de assistência técnica: cursos, aulas, cartilhas e o atlas de doenças e pragas, escolhidos pelo seu agrônomo. Sem custo para você.</p>
          </div>
          <nav aria-label="Aprender">
            <b>Aprender</b>
            <Link href="/academy">Início</Link>
            <Link href="/academy/cursos">Cursos</Link>
            <Link href="/academy/biblioteca">Aulas e materiais</Link>
            <Link href="/academy/atlas">Atlas de doenças e pragas</Link>
            <Link href="/academy/noticias">Notícias do agro</Link>
          </nav>
          <nav aria-label="Sua conta">
            <b>Você</b>
            {ehAluno ? <Link href="/academy/meus-cursos">Meus cursos e certificados</Link> : null}
            {ehEstudio ? <Link href="/academy/estudio">Estúdio</Link> : null}
            <Link href="/sites">Trocar de site</Link>
          </nav>
          <nav aria-label="Ajuda">
            <b>Ajuda</b>
            <Link href={ehAluno ? '/connect/pedidos/novo' : '/connect'}>Fale com o seu técnico</Link>
            <Link href="/validar">Conferir um certificado</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos de uso</Link>
          </nav>
          <div className="ac-rodape-app">
            <b>Leve no celular</b>
            <p>No menu do navegador, escolha &ldquo;Adicionar à tela inicial&rdquo;: a Academy abre como um aplicativo.</p>
          </div>
        </div>
        <div className="ac-rodape-base">
          <span><b>AgroTech Academy</b> · aprender no seu ritmo</span>
          <span>Certificado de participação do escritório</span>
        </div>
      </footer>
    </div>
  );
}
