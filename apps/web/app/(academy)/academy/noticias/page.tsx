import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca } from '@/lib/academy-dados';
import { ROTULO_TEMA, TEMAS, filtrarConteudos } from '@/lib/academy';
import { CartaoAula } from '@/components/academy/cartao-aula';

export const dynamic = 'force-dynamic';

type Busca = { q?: string; tema?: string };

export default async function NoticiasDoAgro({ searchParams }: { searchParams: Promise<Busca> }) {
  const f = await searchParams;
  const { sb, ehAluno } = await exigirConta('academy');
  const bib = await carregarBiblioteca(sb, ehAluno);
  const todas = bib.conteudos.filter((c) => c.tipo === 'noticia');
  const lista = filtrarConteudos(todas, { busca: f.q, tema: f.tema });
  const filtrando = Boolean(f.q || f.tema);

  return (
    <main className="ac-principal">
      <h1 className="ac-titulo-pagina">Notícias do agro</h1>
      <p className="ac-subtitulo">Resumos escritos pelo seu escritório, sempre com a fonte e o link da matéria original.</p>

      <form className="ac-filtros" method="get">
        <div className="campo busca">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="ex.: chuva, preço do café, geada…" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="tema">Tema</label>
          <select id="tema" name="tema" defaultValue={f.tema ?? ''}>
            <option value="">Todos</option>
            {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
          </select>
        </div>
        <button className="btn verde" type="submit">Filtrar</button>
        {filtrando ? <Link className="btn sec" href="/academy/noticias">Limpar</Link> : null}
      </form>

      {lista.length === 0 ? (
        <div className="ac-vazio">
          <b>{todas.length === 0 ? 'Ainda não há notícias' : 'Nada encontrado'}</b>
          {todas.length === 0 ? 'Quando o escritório publicar uma notícia, ela aparece aqui.' : 'Tente outras palavras ou limpe os filtros.'}
        </div>
      ) : (
        <div className="ac-aulas">
          {lista.map((c) => <CartaoAula key={c.id} conteudo={c} />)}
        </div>
      )}
    </main>
  );
}
