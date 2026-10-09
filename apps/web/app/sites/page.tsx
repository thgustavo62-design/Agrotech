import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { SITES, SITES_ORDEM, destinoDoSite, loginDoSite } from '@/lib/sites';
import { papelDeValor } from '@/lib/supabase/rotas';
import { LogoIcone } from '@/components/logo';
import { BotaoSair } from '@/components/botao-sair';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AgroTech — escolha o site' };

/** "Trocar de site": quem já entrou escolhe para onde ir. Cada site abre no próprio molde, com o próprio menu. */
export default async function EscolherSite() {
  const perfil = await perfilAtual();
  if (!perfil) redirect(loginDoSite('assistencia'));
  const papel = papelDeValor(perfil.role);

  return (
    <main className="hub">
      <header className="hub-topo">
        <span className="hub-marca"><LogoIcone tamanho={34} /> <b>AgroTech</b></span>
        <span className="hub-quem">{perfil.nome ?? 'Minha conta'} · <BotaoSair action="/sair" className="link-sair" rotulo="sair" /></span>
      </header>
      <h1>Para onde você quer ir?</h1>
      <p className="hub-sub">Um login, três sites. Cada um tem o próprio jeito de usar.</p>
      <div className="hub-grade">
        {SITES_ORDEM.map((id) => {
          const s = SITES[id];
          return (
            <Link key={id} className="hub-cartao" data-site={id} href={destinoDoSite(id, papel) ?? loginDoSite(id)}>
              <span className="hub-nome">{s.nome}</span>
              <span className="hub-chamada">{s.chamada}</span>
              <span className="hub-desc">{s.descricao}</span>
              <span className="hub-ir">Abrir →</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
