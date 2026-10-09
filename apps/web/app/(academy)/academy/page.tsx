import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca, indicesPorId } from '@/lib/academy-dados';
import { ROTULO_TEMA, TEMAS } from '@/lib/academy';
import { fundoDaCapa, capaDoTema, progressoDoCurso, proximaAula } from '@/lib/academy-cursos';
import { CapaCurso } from '@/components/academy/capa-curso';
import { CartaoAula } from '@/components/academy/cartao-aula';
import { CartaoCurso } from '@/components/academy/cartao-curso';
import { Trilho } from '@/components/academy/trilho';

export const dynamic = 'force-dynamic';

export default async function InicioAcademy() {
  const { sb, perfil, ehAluno } = await exigirConta('academy');
  const bib = await carregarBiblioteca(sb, ehAluno);

  const primeiroNome = (perfil.nome ?? '').trim().split(/\s+/)[0] || null;
  const progresso = (c: (typeof bib.cursos)[number]) => progressoDoCurso(c.aulas, bib.concluidos);
  const cursosPorId = indicesPorId(bib.cursos);
  const conteudosPorId = indicesPorId(bib.conteudos);

  const destaque = bib.cursos.find((c) => c.destaque) ?? bib.cursos[0] ?? null;
  const continuar = bib.cursos
    .filter((c) => bib.matriculas.has(c.id) && !bib.matriculas.get(c.id)!.concluido_em)
    .sort((a, b) => (bib.matriculas.get(b.id)!.criado_em).localeCompare(bib.matriculas.get(a.id)!.criado_em));
  const indicados = bib.indicacoes.filter((i) => !i.concluido_em);
  const naoAvulsos = new Set(bib.cursos.flatMap((c) => c.aulas.map((a) => a.conteudo_id)));
  const avulsas = bib.conteudos.filter((c) => c.tipo !== 'noticia' && !naoAvulsos.has(c.id)).slice(0, 8);
  const noticias = bib.conteudos.filter((c) => c.tipo === 'noticia').slice(0, 3);
  const novos = bib.cursos.slice(0, 12);
  const temas = TEMAS.map((t) => ({
    tema: t,
    cursos: bib.cursos.filter((c) => c.tema === t).length,
    aulas: bib.conteudos.filter((c) => c.tema === t && c.tipo !== 'noticia').length,
  })).filter((t) => t.cursos + t.aulas > 0);
  const vazio = bib.cursos.length === 0 && bib.conteudos.length === 0;

  return (
    <>
      <section
        className="ac-hero"
        style={{ backgroundImage: 'linear-gradient(105deg, rgba(42,24,5,.95) 0%, rgba(42,24,5,.78) 48%, rgba(42,24,5,.45) 100%), url(/banners/cafe-cereja.jpg)' }}
      >
        <div className="ac-hero-interno">
          <div>
            <h1>{primeiroNome ? <>Olá, {primeiroNome}. </> : null}Aprenda no seu ritmo, <em>com o que o seu agrônomo escolheu.</em></h1>
            <p>Cursos, aulas em vídeo e texto e certificado de participação — no celular ou no computador, sem pressa e sem custo para você.</p>
            <form className="ac-busca-grande" action="/academy/cursos" method="get" role="search">
              <input name="q" type="search" placeholder="O que você quer aprender? (ex.: calagem, café, adubação)" aria-label="Buscar cursos e aulas" autoComplete="off" />
              <button type="submit">Buscar</button>
            </form>
            <div className="ac-hero-acoes" style={{ marginTop: 18 }}>
              {destaque ? <Link className="ac-btn ac-btn-ouro" href={`/academy/cursos/${destaque.id}`}>Ver curso em destaque</Link> : null}
              <Link className="ac-btn ac-btn-claro" href="/academy/cursos">Explorar todos os cursos</Link>
            </div>
          </div>
          {destaque ? (
            <Link className="ac-hero-capa" href={`/academy/cursos/${destaque.id}`} aria-label={`Curso em destaque: ${destaque.titulo}`}>
              <CapaCurso tema={destaque.tema} titulo={destaque.titulo} capaUrl={destaque.capa_url} />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="ac-faixa">
        <div className="ac-faixa-interna">
          <span><b>{bib.cursos.length}</b> {bib.cursos.length === 1 ? 'curso' : 'cursos'}</span>
          <span><b>{bib.conteudos.filter((c) => c.tipo !== 'noticia').length}</b> aulas e materiais</span>
          <span>Certificado de participação ao concluir</span>
          {ehAluno ? <span><b>{bib.certificados.size}</b> {bib.certificados.size === 1 ? 'certificado seu' : 'certificados seus'}</span> : null}
        </div>
      </div>

      {vazio ? (
        <div className="ac-principal">
          <div className="ac-vazio">
            <b>A Academy do seu escritório ainda não tem cursos</b>
            Quando o seu agrônomo publicar o primeiro curso ou indicar uma aula, ele aparece aqui — e você recebe um aviso.
          </div>
        </div>
      ) : null}

      {continuar.length > 0 ? (
        <Trilho titulo="Continue de onde parou" subtitulo="Seus cursos em andamento">
          {continuar.map((c) => {
            const p = progresso(c);
            const prox = proximaAula(c.aulas, bib.concluidos);
            return <CartaoCurso key={c.id} curso={c} progresso={p} href={prox ? `/academy/aula/${prox.conteudo_id}?curso=${c.id}` : undefined} />;
          })}
        </Trilho>
      ) : null}

      {indicados.length > 0 ? (
        <Trilho titulo="Indicado pelo seu agrônomo" subtitulo="Escolhido para você depois de uma visita ou de um laudo">
          {indicados.map((i) => {
            const curso = i.curso_id ? cursosPorId.get(i.curso_id) : null;
            const conteudo = i.conteudo_id ? conteudosPorId.get(i.conteudo_id) : null;
            if (curso) return <CartaoCurso key={i.id} curso={curso} progresso={progresso(curso)} indicado />;
            if (conteudo) return <CartaoAula key={i.id} conteudo={conteudo} indicado />;
            return null;
          })}
        </Trilho>
      ) : null}

      {novos.length > 0 ? (
        <Trilho titulo="Cursos para você" subtitulo="Do mais novo para o mais antigo" verTodos={{ href: '/academy/cursos' }}>
          {novos.map((c) => <CartaoCurso key={c.id} curso={c} progresso={bib.matriculas.has(c.id) ? progresso(c) : null} />)}
        </Trilho>
      ) : null}

      {temas.length > 0 ? (
        <section className="ac-secao">
          <header className="ac-secao-cabecalho"><div><h2>Explore por tema</h2></div></header>
          <div className="ac-temas">
            {temas.map((t) => (
              <Link key={t.tema} className="ac-tema" href={`/academy/cursos?tema=${t.tema}`} style={{ background: fundoDaCapa(t.tema) }}>
                <span className="ac-capa-simbolo" aria-hidden="true">{capaDoTema(t.tema).simbolo}</span>
                <b>{ROTULO_TEMA[t.tema]}</b>
                <small>{t.cursos > 0 ? `${t.cursos} ${t.cursos === 1 ? 'curso' : 'cursos'}` : ''}{t.cursos > 0 && t.aulas > 0 ? ' · ' : ''}{t.aulas > 0 ? `${t.aulas} ${t.aulas === 1 ? 'aula' : 'aulas'}` : ''}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {avulsas.length > 0 ? (
        <section className="ac-secao">
          <header className="ac-secao-cabecalho"><div><h2>Aulas e materiais avulsos</h2><p>Para ver quando quiser, sem precisar fazer um curso inteiro.</p></div></header>
          <div className="ac-aulas">
            {avulsas.map((c) => <CartaoAula key={c.id} conteudo={c} concluido={bib.concluidos.has(c.id)} />)}
          </div>
        </section>
      ) : null}

      {noticias.length > 0 ? (
        <section className="ac-secao">
          <header className="ac-secao-cabecalho"><div><h2>Notícias do agro</h2><p>Resumos do seu escritório, com a fonte e o link da matéria original.</p></div><Link href="/academy/noticias">Ver todas →</Link></header>
          <div className="ac-aulas">
            {noticias.map((c) => <CartaoAula key={c.id} conteudo={c} />)}
          </div>
        </section>
      ) : null}

      <div style={{ height: 40 }} />
    </>
  );
}
