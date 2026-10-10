import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { fichaPorSlug, fonteDaFicha, fotosDaFicha } from '@/lib/atlas-base';
import { GRUPOS_DE_PARTE, fichasParecidas, linksDePesquisa, noGrupo } from '@/lib/atlas';
import { linkPedirAjuda } from '@/lib/connect';
import { GaleriaAtlas } from '@/components/atlas/galeria';
import { CartaoFicha } from '@/components/atlas/cartao-ficha';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = fichaPorSlug(slug);
  return { title: f ? `${f.nome} · Atlas · AgroTech Academy` : 'Atlas · AgroTech Academy' };
}

const nivel = (n: string): 'alta' | 'media' | 'baixa' => (/extrema|elevada|alta/i.test(n) ? 'alta' : /m[eé]dia|moderada/i.test(n) ? 'media' : 'baixa');

export default async function FichaDoAtlas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ehAluno } = await exigirConta('academy');
  const f = fichaPorSlug(slug);
  if (!f) notFound();
  const fonte = fonteDaFicha(f);
  const onde = GRUPOS_DE_PARTE.filter((g) => noGrupo(f, g.id));
  const parecidas = fichasParecidas(f);

  return (
    <>
      <section className="ac-atlas-faixa">
        <div className="ac-atlas-faixa-interno">
          <p className="ac-migalha"><Link href="/academy">Academy</Link> / <Link href="/academy/atlas">Atlas</Link> / {f.nome}</p>
          <div className="ac-atlas-faixa-topo">
            <div>
              <span className="ac-atlas-selo ac-atlas-selo-solto" data-tipo={f.tipo}>{f.tipo === 'doenca' ? 'Doença' : 'Praga'}</span>
              <h1>{f.nome}</h1>
              <p className="ac-atlas-cientifico">{f.cientifico}{f.outrosNomes?.length ? ` · também chamada de ${f.outrosNomes.join(', ')}` : ''}</p>
            </div>
            {ehAluno ? (
              <Link className="btn ac-atlas-cta" href={linkPedirAjuda({ assunto: `Suspeita de ${f.nome.toLowerCase()}`, categoria: 'problema_lavoura', origem: 'atlas' })}>
                Suspeito disso na minha lavoura
              </Link>
            ) : null}
          </div>
          <ul className="ac-atlas-fatos" aria-label="Resumo">
            <li data-nivel={nivel(f.importancia.campo)}><span>Importância no campo</span><b>{f.importancia.campo}</b></li>
            <li data-nivel={nivel(f.importancia.viveiro)}><span>Importância no viveiro</span><b>{f.importancia.viveiro}</b></li>
            <li><span>Onde aparece</span><b>{onde.map((g) => g.rotulo.replace(/^(Na|No) /, '')).join(' · ')}</b></li>
          </ul>
        </div>
      </section>

      <main className="ac-principal ac-atlas-pagina">
        <div className="ac-atlas-ficha">
          <GaleriaAtlas fotos={fotosDaFicha(f)} nome={f.nome} creditos={f.creditos} />

          <div className="ac-atlas-texto">
            <section>
              <h2><span aria-hidden="true">1</span> O que é</h2>
              {f.sobre.map((p) => <p key={p}>{p}</p>)}
              {f.confunde ? <p className="ac-atlas-aviso"><b>Cuidado:</b> {f.confunde}</p> : null}
            </section>
            <section>
              <h2><span aria-hidden="true">2</span> O que favorece</h2>
              <ul>{f.favorecem.map((p) => <li key={p}>{p}</li>)}</ul>
            </section>
            <section>
              <h2><span aria-hidden="true">3</span> Como manejar</h2>
              <ul>{f.manejo.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="ac-atlas-aviso">Produto, dose e época de aplicação são decisão do seu agrônomo, com receituário.</p>
            </section>
            {f.monitoramento ? (
              <section>
                <h2><span aria-hidden="true">4</span> Como monitorar</h2>
                <ul>{f.monitoramento.map((p) => <li key={p}>{p}</li>)}</ul>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="ac-atlas-fonte" aria-label="Fonte">
          <b>Fonte</b>
          <p>
            {fonte.instituicao} — {fonte.autores}. <i>{fonte.titulo}</i>.{' '}
            <a href={fonte.url} target="_blank" rel="noopener noreferrer">Abrir o documento original</a>
          </p>
          <p className="nota">
            Reprodução com autorização da Embrapa, com fonte e autoria das fotos. As condições descritas são as da Amazônia: épocas,
            níveis e variedades podem ser diferentes no seu município. Quer ler mais?{' '}
            {linksDePesquisa(f.nome).map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 10 }}>{a.rotulo}</a>)}
          </p>
        </aside>

        {parecidas.length > 0 ? (
          <section className="ac-atlas-trilha" aria-labelledby="t-parecidas">
            <div className="ac-atlas-trilha-topo">
              <h2 id="t-parecidas">Fichas parecidas</h2>
              <Link href="/academy/atlas">Ver o Atlas inteiro</Link>
            </div>
            <div className="ac-atlas-fila">{parecidas.map((x) => <CartaoFicha key={x.slug} ficha={x} />)}</div>
          </section>
        ) : null}
      </main>
    </>
  );
}
