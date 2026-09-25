import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { Grade, Metrica, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { IconeProdutores, IconePropriedades } from '@/components/icones';

export const dynamic = 'force-dynamic';

export default async function Produtores() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('produtores')
    .select('id, nome, email, fone, origem, propriedades:propriedades(id)')
    .order('nome');

  const produtores = data ?? [];
  const totalPropriedades = produtores.reduce((s, p) => s + ((p.propriedades as unknown[])?.length ?? 0), 0);
  const viaLaudo = produtores.filter((p) => p.origem === 'pdf').length;

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Carteira"
        titulo="Produtores"
        descricao="Quem você atende. O produtor é a raiz — talhões, análises e visitas ficam ligados a ele."
        tags={['Carteira', 'Relacionamento', 'Assistência']}
        acoes={<Link className="btn verde" href="/app/produtores/nova">Novo produtor</Link>}
      />

      {produtores.length > 0 && (
        <Grade cols={3} style={{ marginBottom: 14 }}>
          <Metrica rotulo="Produtores" valor={produtores.length} icone={IconeProdutores} />
          <Metrica rotulo="Propriedades" valor={totalPropriedades} icone={IconePropriedades} />
          <Metrica rotulo="Cadastrados via laudo" valor={viaLaudo} />
        </Grade>
      )}

      {produtores.length === 0 ? (
        <Vazio titulo="Nenhum produtor cadastrado">
          Comece por <Link href="/app/produtores/nova">cadastrar um produtor</Link>.
        </Vazio>
      ) : (
        <div className="lista">
          {produtores.map((p) => (
            <div className="item" key={p.id as string}>
              <div className="cresce">
                <h3>{p.nome as string}</h3>
                <small>
                  {/* deno-lint-ignore no-explicit-any */}
                  {(p as any).propriedades?.length ?? 0} propriedade(s)
                  {p.email ? ` · ${p.email}` : ''}
                </small>
              </div>
              {p.origem === 'pdf' ? <span className="tag alerta">via laudo</span> : null}
              <Link className="btn sec mini" href={`/app/produtores/${p.id}`}>Abrir</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
