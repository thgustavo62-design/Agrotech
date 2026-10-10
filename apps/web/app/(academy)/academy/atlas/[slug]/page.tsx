import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { fichaPorSlug, fonteDaFicha, fotosDaFicha } from '@/lib/atlas-base';
import { linksDePesquisa } from '@/lib/atlas';
import { linkPedirAjuda } from '@/lib/connect';
import { Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = fichaPorSlug(slug);
  return { title: f ? `${f.nome} · Atlas · AgroTech Academy` : 'Atlas · AgroTech Academy' };
}

const tomDaImportancia = (n: string): 'ruim' | 'alerta' | 'cinza' => (/extrema|elevada|alta/i.test(n) ? 'ruim' : /m[eé]dia|moderada/i.test(n) ? 'alerta' : 'cinza');

export default async function FichaDoAtlas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ehAluno } = await exigirConta('academy');
  const f = fichaPorSlug(slug);
  if (!f) notFound();
  const fonte = fonteDaFicha(f);
  const fotos = fotosDaFicha(f);

  return (
    <main className="ac-principal">
      <p className="ac-migalha ac-migalha-clara"><Link href="/academy">Academy</Link> / <Link href="/academy/atlas">Atlas</Link> / {f.nome}</p>

      <header className="ac-atlas-cabeca">
        <div>
          <Tag tom={f.tipo === 'doenca' ? 'alerta' : 'cinza'}>{f.tipo === 'doenca' ? 'doença' : 'praga'}</Tag>
          <h1 className="ac-titulo-pagina" style={{ marginTop: 8 }}>{f.nome}</h1>
          <p className="ac-atlas-cientifico">{f.cientifico}{f.outrosNomes?.length ? ` · também chamada de ${f.outrosNomes.join(', ')}` : ''}</p>
          <p className="ac-atlas-importancia">
            <span>No campo <Tag tom={tomDaImportancia(f.importancia.campo)}>{f.importancia.campo.toLowerCase()}</Tag></span>
            <span>No viveiro <Tag tom={tomDaImportancia(f.importancia.viveiro)}>{f.importancia.viveiro.toLowerCase()}</Tag></span>
          </p>
        </div>
        {ehAluno ? (
          <Link className="btn verde" href={linkPedirAjuda({ assunto: `Suspeita de ${f.nome.toLowerCase()}`, categoria: 'problema_lavoura', origem: 'atlas' })}>
            Suspeito disso na minha lavoura
          </Link>
        ) : null}
      </header>

      <section className="ac-atlas-galeria" aria-label="Fotos de referência">
        {fotos.map((src, i) => (
          <a key={src} href={src} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto estática da própria pasta public, já reduzida */}
            <img src={src} alt={`${f.nome}: foto ${i + 1} de ${fotos.length}`} loading={i === 0 ? 'eager' : 'lazy'} />
          </a>
        ))}
        <p className="nota">Fotos: {f.creditos}. Toque na foto para ampliar.</p>
      </section>

      <div className="ac-atlas-texto">
        <section>
          <h2>O que é</h2>
          {f.sobre.map((p) => <p key={p}>{p}</p>)}
          {f.confunde ? <p className="ac-atlas-aviso"><b>Cuidado:</b> {f.confunde}</p> : null}
        </section>
        <section>
          <h2>O que favorece</h2>
          <ul>{f.favorecem.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
        <section>
          <h2>Como manejar</h2>
          <ul>{f.manejo.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="nota">Produto, dose e época de aplicação são decisão do seu agrônomo, com receituário.</p>
        </section>
        {f.monitoramento ? (
          <section>
            <h2>Como monitorar</h2>
            <ul>{f.monitoramento.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        ) : null}
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
    </main>
  );
}
