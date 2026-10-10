import Link from 'next/link';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { FICHAS, fotosDaFicha } from '@/lib/atlas-base';
import { buscarFichas, linksDePesquisa } from '@/lib/atlas';
import { Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Atlas de doenças e pragas · AgroTech Academy' };

type Busca = { q?: string; tipo?: string };

/** Atlas de doenças e pragas: fichas com fotos para reconhecer o problema na lavoura. Conteúdo-base: Embrapa (café conilon). */
export default async function AtlasDeDoencasEPragas({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirConta('academy');
  const f = await searchParams;
  const tipo = f.tipo === 'doenca' || f.tipo === 'praga' ? f.tipo : '';
  const lista = buscarFichas({ q: f.q, tipo });
  const filtrando = Boolean(f.q || tipo);
  const atalhos = f.q ? linksDePesquisa(f.q) : [];

  return (
    <main className="ac-principal">
      <h1 className="ac-titulo-pagina">Atlas de doenças e pragas</h1>
      <p className="ac-subtitulo">
        Fichas com fotos para reconhecer o problema na lavoura de café conilon — {FICHAS.filter((x) => x.tipo === 'doenca').length} doenças e{' '}
        {FICHAS.filter((x) => x.tipo === 'praga').length} pragas, com conteúdo da Embrapa e a fonte em cada ficha.
      </p>

      <form className="ac-filtros" method="get" role="search">
        <div className="campo busca">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="ex.: ferrugem, broca, folha amarela, raiz…" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo}>
            <option value="">Doenças e pragas</option>
            <option value="doenca">Só doenças</option>
            <option value="praga">Só pragas</option>
          </select>
        </div>
        <button className="btn verde" type="submit">Buscar</button>
        {filtrando ? <Link className="btn sec" href="/academy/atlas">Limpar</Link> : null}
      </form>

      {lista.length === 0 ? (
        <div className="ac-vazio">
          <b>Nada encontrado no Atlas</b>
          Tente outra palavra (o nome, a parte da planta ou o sintoma).
          {atalhos.length > 0 ? (
            <p style={{ marginTop: 10 }}>
              {atalhos.map((a) => <a key={a.url} className="btn sec" style={{ marginRight: 8 }} href={a.url} target="_blank" rel="noopener noreferrer">{a.rotulo}</a>)}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <p className="nota" style={{ margin: '0 0 12px' }}>{lista.length} ficha(s){filtrando ? ' encontrada(s)' : ''}.</p>
          <div className="ac-atlas-grade">
            {lista.map((x) => (
              <Link key={x.slug} className="ac-atlas-cartao" href={`/academy/atlas/${x.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto estática da própria pasta public, já reduzida */}
                <img src={fotosDaFicha(x)[0]} alt={`${x.nome}: foto de referência`} loading="lazy" width={320} height={220} />
                <span className="ac-atlas-corpo">
                  <span className="ac-atlas-tipo"><Tag tom={x.tipo === 'doenca' ? 'alerta' : 'cinza'}>{x.tipo === 'doenca' ? 'doença' : 'praga'}</Tag></span>
                  <b>{x.nome}</b>
                  <i>{x.cientifico}</i>
                  <small>Importância no campo: {x.importancia.campo.toLowerCase()}</small>
                </span>
              </Link>
            ))}
          </div>
          {f.q ? (
            <p className="nota" style={{ marginTop: 18 }}>
              Não é o que procura? {atalhos.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>{a.rotulo}</a>)}
            </p>
          ) : null}
        </>
      )}

      <p className="nota" style={{ marginTop: 26 }}>
        As fichas são um apoio para reconhecer o problema; <b>o diagnóstico e a escolha do produto são do seu agrônomo</b>. Épocas e níveis vêm
        de estudos da Embrapa Rondônia (condições da Amazônia) e podem ser diferentes no seu município.
      </p>
    </main>
  );
}
