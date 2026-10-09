import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca } from '@/lib/academy-dados';
import { NIVEIS, ROTULO_NIVEL, ROTULO_TEMA, TEMAS, filtrarConteudos } from '@/lib/academy';
import { filtrarCursos, progressoDoCurso } from '@/lib/academy-cursos';
import { CartaoAula } from '@/components/academy/cartao-aula';
import { CartaoCurso } from '@/components/academy/cartao-curso';

export const dynamic = 'force-dynamic';

type Busca = { q?: string; tema?: string; nivel?: string; cultura?: string };

export default async function CatalogoDeCursos({ searchParams }: { searchParams: Promise<Busca> }) {
  const f = await searchParams;
  const { sb, ehAluno } = await exigirConta('academy');
  const bib = await carregarBiblioteca(sb, ehAluno);

  const cursos = filtrarCursos(bib.cursos, { busca: f.q, tema: f.tema, nivel: f.nivel, cultura: f.cultura });
  // aulas avulsas que combinam com a busca: o aluno acha "calagem" mesmo que ela não esteja num curso
  const emCurso = new Set(bib.cursos.flatMap((c) => c.aulas.map((a) => a.conteudo_id)));
  const avulsas = (f.q || f.tema || f.cultura
    ? filtrarConteudos(bib.conteudos.filter((c) => c.tipo !== 'noticia' && !emCurso.has(c.id)), { busca: f.q, tema: f.tema, cultura: f.cultura })
        .filter((c) => !f.nivel || c.nivel === f.nivel)
    : []);
  const culturas = [...new Set(bib.cursos.map((c) => c.cultura).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtrando = Boolean(f.q || f.tema || f.nivel || f.cultura);

  return (
    <main className="ac-principal">
      <h1 className="ac-titulo-pagina">Cursos</h1>
      <p className="ac-subtitulo">{bib.cursos.length === 0 ? 'Ainda não há cursos publicados.' : `${bib.cursos.length} ${bib.cursos.length === 1 ? 'curso disponível' : 'cursos disponíveis'} para você.`}</p>

      <form className="ac-filtros" method="get">
        <div className="campo busca">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="ex.: calagem, café, adubação…" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="tema">Tema</label>
          <select id="tema" name="tema" defaultValue={f.tema ?? ''}>
            <option value="">Todos</option>
            {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nivel">Nível</label>
          <select id="nivel" name="nivel" defaultValue={f.nivel ?? ''}>
            <option value="">Todos</option>
            {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
          </select>
        </div>
        {culturas.length > 0 ? (
          <div className="campo">
            <label htmlFor="cultura">Cultura</label>
            <select id="cultura" name="cultura" defaultValue={f.cultura ?? ''}>
              <option value="">Todas</option>
              {culturas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : null}
        <button className="btn verde" type="submit">Filtrar</button>
        {filtrando ? <Link className="btn sec" href="/academy/cursos">Limpar</Link> : null}
      </form>

      {cursos.length === 0 && avulsas.length === 0 ? (
        <div className="ac-vazio">
          <b>{filtrando ? 'Nada encontrado com esses filtros' : 'Ainda não há cursos'}</b>
          {filtrando ? 'Tente outras palavras ou limpe os filtros.' : 'Quando o seu agrônomo publicar, os cursos aparecem aqui.'}
        </div>
      ) : null}

      {cursos.length > 0 ? (
        <div className="ac-grade">
          {cursos.map((c) => <CartaoCurso key={c.id} curso={c} progresso={bib.matriculas.has(c.id) ? progressoDoCurso(c.aulas, bib.concluidos) : null} />)}
        </div>
      ) : null}

      {avulsas.length > 0 ? (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 22, letterSpacing: '-.02em' }}>Aulas e materiais avulsos</h2>
          <div className="ac-aulas" style={{ marginTop: 12 }}>
            {avulsas.map((c) => <CartaoAula key={c.id} conteudo={c} concluido={bib.concluidos.has(c.id)} />)}
          </div>
        </section>
      ) : null}
    </main>
  );
}
