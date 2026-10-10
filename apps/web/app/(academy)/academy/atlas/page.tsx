import Link from 'next/link';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarFichasPublicadas } from '@/lib/atlas-dados';
import { FICHAS } from '@/lib/atlas-base';
import { GRUPOS_DE_PARTE, buscarFichas, linksDePesquisa, maisImportantes, noGrupo } from '@/lib/atlas';
import { CartaoFicha } from '@/components/atlas/cartao-ficha';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Atlas de doenças e pragas · AgroTech Academy' };

type Busca = { q?: string; tipo?: string; parte?: string };


/**
 * Atlas de doenças e pragas — no molde das plataformas de cursos: banner com busca, chips de navegação e "trilhas" que
 * organizam as fichas pelo lugar onde o problema aparece na planta. Com busca ou filtro, vira uma grade de resultados.
 */
export default async function AtlasDeDoencasEPragas({ searchParams }: { searchParams: Promise<Busca> }) {
  const { sb } = await exigirConta('academy');
  const f = await searchParams;
  // fichas-base (Embrapa, no código) + as publicadas pelo escritório (banco)
  const todas = [...FICHAS, ...(await carregarFichasPublicadas(sb))];
  const DOENCAS = todas.filter((x) => x.tipo === 'doenca').length;
  const PRAGAS = todas.filter((x) => x.tipo === 'praga').length;
  const FOTOS = todas.reduce((s, x) => s + x.fotos, 0);
  const doEscritorio = todas.filter((x) => x.origem === 'escritorio').length;
  const tipo = f.tipo === 'doenca' || f.tipo === 'praga' ? f.tipo : '';
  const parte = GRUPOS_DE_PARTE.some((g) => g.id === f.parte) ? (f.parte as string) : '';
  const q = (f.q ?? '').slice(0, 80);
  const filtrando = Boolean(q.trim() || tipo || parte);
  const lista = buscarFichas({ q, tipo, parte }, todas);
  const atalhos = q.trim() ? linksDePesquisa(q) : [];

  const href = (m: Partial<Busca>) => {
    const novo = { q: q || undefined, tipo: tipo || undefined, parte: parte || undefined, ...m };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(novo)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/academy/atlas?${s}` : '/academy/atlas';
  };
  const contar = (g: string) => buscarFichas({ tipo, parte: g }, todas).length;

  return (
    <>
      <section className="ac-atlas-hero">
        <div className="ac-atlas-hero-interno">
          <p className="ac-atlas-olho">Atlas · café conilon</p>
          <h1>Reconheça doenças e pragas da sua lavoura</h1>
          <p>Fichas com fotos de referência para saber o que é, o que favorece, como manejar e como monitorar. Quando precisar, peça ajuda ao seu técnico direto da ficha.</p>
          <form className="ac-busca-grande" method="get" role="search">
            <input name="q" defaultValue={q} placeholder="Busque por nome, sintoma ou parte da planta (ex.: folha amarela, raiz)" aria-label="Buscar no Atlas" autoComplete="off" />
            {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
            {parte ? <input type="hidden" name="parte" value={parte} /> : null}
            <button type="submit">Buscar</button>
          </form>
          <ul className="ac-atlas-numeros" aria-label="O que tem no Atlas">
            <li><b>{DOENCAS}</b> doenças</li>
            <li><b>{PRAGAS}</b> pragas</li>
            <li><b>{FOTOS}</b> fotos</li>
            <li><b>Embrapa</b> como fonte</li>
            {doEscritorio > 0 ? <li><b>{doEscritorio}</b> do seu escritório</li> : null}
          </ul>
        </div>
      </section>

      <main className="ac-principal ac-atlas-pagina">
        <nav className="ac-atlas-chips" aria-label="Filtrar o Atlas">
          <div className="ac-atlas-chips-linha" role="group" aria-label="Tipo">
            <Link prefetch={false} href={href({ tipo: undefined })} data-ativo={!tipo}>Tudo</Link>
            <Link prefetch={false} href={href({ tipo: 'doenca' })} data-ativo={tipo === 'doenca'}>Doenças <small>{DOENCAS}</small></Link>
            <Link prefetch={false} href={href({ tipo: 'praga' })} data-ativo={tipo === 'praga'}>Pragas <small>{PRAGAS}</small></Link>
          </div>
          <div className="ac-atlas-chips-linha" role="group" aria-label="Onde aparece">
            <span className="ac-atlas-chips-rotulo">Onde aparece</span>
            <Link prefetch={false} href={href({ parte: undefined })} data-ativo={!parte}>Qualquer parte</Link>
            {GRUPOS_DE_PARTE.map((g) => (
              <Link prefetch={false} key={g.id} href={href({ parte: g.id })} data-ativo={parte === g.id}>{g.rotulo.replace(/^(Na|No) /, '')} <small>{contar(g.id)}</small></Link>
            ))}
          </div>
        </nav>

        {filtrando ? (
          lista.length === 0 ? (
            <div className="ac-vazio">
              <b>Nada encontrado no Atlas</b>
              Tente outra palavra (o nome, a parte da planta ou o sintoma) ou limpe os filtros.
              <p style={{ marginTop: 12 }}>
                <Link className="btn sec" style={{ marginRight: 8 }} href="/academy/atlas">Limpar filtros</Link>
                {atalhos.map((a) => <a key={a.url} className="btn sec" style={{ marginRight: 8 }} href={a.url} target="_blank" rel="noopener noreferrer">{a.rotulo}</a>)}
              </p>
            </div>
          ) : (
            <section aria-label="Resultados">
              <div className="ac-atlas-resultados-topo">
                <p className="nota" style={{ margin: 0 }}>{lista.length} ficha(s) encontrada(s).</p>
                <Link href="/academy/atlas">Limpar filtros</Link>
              </div>
              <div className="ac-atlas-grade">{lista.map((x) => <CartaoFicha key={x.slug} ficha={x} />)}</div>
              {q.trim() ? (
                <p className="nota" style={{ marginTop: 18 }}>
                  Não é o que procura? {atalhos.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>{a.rotulo}</a>)}
                </p>
              ) : null}
            </section>
          )
        ) : (
          <>
            <section className="ac-atlas-trilha" aria-labelledby="t-importantes">
              <div className="ac-atlas-trilha-topo">
                <h2 id="t-importantes">As mais importantes no campo</h2>
                <p>Quem mais derruba produção ou qualidade: comece por aqui.</p>
              </div>
              <div className="ac-atlas-fila">{maisImportantes(todas).map((x) => <CartaoFicha key={x.slug} ficha={x} />)}</div>
            </section>

            {GRUPOS_DE_PARTE.map((g) => {
              const itens = todas.filter((x) => noGrupo(x, g.id));
              if (itens.length === 0) return null;
              return (
                <section className="ac-atlas-trilha" key={g.id} aria-labelledby={`t-${g.id}`}>
                  <div className="ac-atlas-trilha-topo">
                    <h2 id={`t-${g.id}`}>{g.rotulo}</h2>
                    <Link prefetch={false} href={href({ parte: g.id })}>Ver as {itens.length}</Link>
                  </div>
                  <div className="ac-atlas-fila">{itens.map((x) => <CartaoFicha key={x.slug} ficha={x} />)}</div>
                </section>
              );
            })}
          </>
        )}

        <aside className="ac-atlas-rodape-aviso">
          <b>Apoio ao reconhecimento, não receita.</b> O diagnóstico e a escolha do produto são do seu agrônomo. Épocas e níveis vêm de estudos da
          Embrapa Rondônia (condições da Amazônia) e podem ser diferentes no seu município.
        </aside>
      </main>
    </>
  );
}
