import Link from 'next/link';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca } from '@/lib/academy-dados';
import { ROTULO_TEMA, TEMAS, filtrarConteudos } from '@/lib/academy';
import { CartaoAula } from '@/components/academy/cartao-aula';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Aulas e materiais · AgroTech Academy' };

type Busca = { q?: string; tipo?: string; tema?: string };
const TIPOS = [
  { id: 'video', rotulo: 'Vídeos' },
  { id: 'artigo', rotulo: 'Artigos' },
  { id: 'material', rotulo: 'Cartilhas e materiais' },
] as const;

/** Aulas e materiais fora de curso (vídeos, artigos, cartilhas), com busca e filtro por formato e tema. */
export default async function Biblioteca({ searchParams }: { searchParams: Promise<Busca> }) {
  const f = await searchParams;
  const { sb, ehAluno } = await exigirConta('academy');
  const bib = await carregarBiblioteca(sb, ehAluno);
  const todas = bib.conteudos.filter((c) => c.tipo !== 'noticia');
  const tipo = TIPOS.some((t) => t.id === f.tipo) ? (f.tipo as string) : '';
  const lista = filtrarConteudos(todas, { busca: f.q, tipo: tipo || undefined, tema: f.tema });
  const filtrando = Boolean(f.q || tipo || f.tema);
  const contar = (id: string) => todas.filter((c) => c.tipo === id).length;

  const href = (m: Partial<Busca>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, tipo: tipo || undefined, tema: f.tema, ...m })) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/academy/biblioteca?${s}` : '/academy/biblioteca';
  };

  return (
    <main className="ac-principal">
      <h1 className="ac-titulo-pagina">Aulas e materiais</h1>
      <p className="ac-subtitulo">Vídeos, artigos e cartilhas para ver quando quiser, sem precisar fazer um curso inteiro.</p>

      <nav className="ac-atlas-chips" aria-label="Formato">
        <div className="ac-atlas-chips-linha" role="group" aria-label="Formato">
          <Link prefetch={false} href={href({ tipo: undefined })} data-ativo={!tipo}>Tudo <small>{todas.length}</small></Link>
          {TIPOS.map((t) => <Link prefetch={false} key={t.id} href={href({ tipo: t.id })} data-ativo={tipo === t.id}>{t.rotulo} <small>{contar(t.id)}</small></Link>)}
        </div>
      </nav>

      <form className="ac-filtros" method="get" role="search">
        <div className="campo busca">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="ex.: calagem, café, coleta de solo…" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="tema">Tema</label>
          <select id="tema" name="tema" defaultValue={f.tema ?? ''}>
            <option value="">Todos</option>
            {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
          </select>
        </div>
        {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
        <button className="btn verde" type="submit">Filtrar</button>
        {filtrando ? <Link className="btn sec" href="/academy/biblioteca">Limpar</Link> : null}
      </form>

      {lista.length === 0 ? (
        <div className="ac-vazio">
          <b>{todas.length === 0 ? 'Ainda não há aulas avulsas' : 'Nada encontrado'}</b>
          {todas.length === 0 ? 'Quando o escritório publicar um vídeo, artigo ou cartilha, ele aparece aqui.' : 'Tente outras palavras ou limpe os filtros.'}
        </div>
      ) : (
        <div className="ac-aulas">{lista.map((c) => <CartaoAula key={c.id} conteudo={c} concluido={bib.concluidos.has(c.id)} />)}</div>
      )}
    </main>
  );
}
