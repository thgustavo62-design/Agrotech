import Link from 'next/link';
import { exigirConta } from '@/lib/guarda-de-site';
import { carregarBiblioteca, indicesPorId } from '@/lib/academy-dados';
import { carregarFichasPublicadas } from '@/lib/atlas-dados';
import { FICHAS } from '@/lib/atlas-base';
import { ROTULO_TEMA, TEMAS } from '@/lib/academy';
import { fundoDaCapa, capaDoTema, progressoDoCurso, proximaAula } from '@/lib/academy-cursos';
import { CapaCurso } from '@/components/academy/capa-curso';
import { CartaoAula } from '@/components/academy/cartao-aula';
import { CartaoCurso } from '@/components/academy/cartao-curso';
import { Trilho } from '@/components/academy/trilho';
import { IconeArtigos, IconeAtlas, IconeCursos, IconeMateriais, IconeNoticias, IconeVideos } from '@/components/academy/icones-formato';

export const dynamic = 'force-dynamic';

/**
 * Página inicial da Academy: uma apresentação geral (no molde das plataformas de cursos como o SENAR EAD) — abertura com os
 * números reais da biblioteca, busca, destaque, atalhos por formato de conteúdo, novidade — e, logo abaixo, o que é do aluno
 * (continue de onde parou, indicado pelo agrônomo). Todos os números vêm do que existe no escritório; nada é inventado.
 */
export default async function InicioAcademy() {
  const { sb, perfil, ehAluno } = await exigirConta('academy');
  const [bib, fichasDoEscritorio] = await Promise.all([carregarBiblioteca(sb, ehAluno), carregarFichasPublicadas(sb)]);

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

  const doTipo = (tipo: string) => bib.conteudos.filter((c) => c.tipo === tipo).length;
  const nAulasEMateriais = bib.conteudos.filter((c) => c.tipo !== 'noticia').length;
  const nFichas = FICHAS.length + fichasDoEscritorio.length;
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

  const formatos = [
    { href: '/academy/cursos', Icone: IconeCursos, titulo: 'Cursos', n: bib.cursos.length, unidade: ['curso', 'cursos'] as const, texto: 'Trilhas de aulas em módulos, com certificado' },
    { href: '/academy/biblioteca?tipo=video', Icone: IconeVideos, titulo: 'Vídeos', n: doTipo('video'), unidade: ['vídeo', 'vídeos'] as const, texto: 'Aulas curtas para ver no celular' },
    { href: '/academy/biblioteca?tipo=artigo', Icone: IconeArtigos, titulo: 'Artigos', n: doTipo('artigo'), unidade: ['artigo', 'artigos'] as const, texto: 'Textos do seu escritório, direto ao ponto' },
    { href: '/academy/biblioteca?tipo=material', Icone: IconeMateriais, titulo: 'Cartilhas', n: doTipo('material'), unidade: ['material', 'materiais'] as const, texto: 'Guias e checklists para guardar' },
    { href: '/academy/atlas', Icone: IconeAtlas, titulo: 'Atlas de doenças e pragas', n: nFichas, unidade: ['ficha', 'fichas'] as const, texto: 'Reconheça o problema da lavoura com fotos' },
    { href: '/academy/noticias', Icone: IconeNoticias, titulo: 'Notícias do agro', n: doTipo('noticia'), unidade: ['notícia', 'notícias'] as const, texto: 'Resumos com a fonte e o link original' },
  ];

  return (
    <>
      <section className="ac-hero ac-apresentacao">
        <div className="ac-hero-interno">
          <div>
            <p className="ac-eyebrow">AgroTech Academy{primeiroNome ? ` · Olá, ${primeiroNome}` : ''}</p>
            <h1>Explore tudo o que você pode aprender <em>para a sua lavoura.</em></h1>
            <p>Cursos, aulas, cartilhas e um atlas de doenças e pragas — escolhidos pelo seu agrônomo, no celular ou no computador, sem custo para você.</p>
            <ul className="ac-numeros-apresentacao" aria-label="O que tem na Academy">
              <li><b>{bib.cursos.length}</b><span>{plural(bib.cursos.length, 'curso', 'cursos')} em módulos, do básico ao avançado</span></li>
              <li><b>{nAulasEMateriais}</b><span>{plural(nAulasEMateriais, 'aula ou material', 'aulas e materiais')} para ver quando quiser</span></li>
              <li><b>{nFichas}</b><span>{plural(nFichas, 'ficha', 'fichas')} no Atlas de doenças e pragas</span></li>
            </ul>
          </div>
          <div className="ac-vitrine" aria-hidden="true">
            <div className="ac-mosaico">
              <span style={{ backgroundImage: 'url(/atlas/ferrugem-alaranjada-1.jpg)' }} />
              <span style={{ backgroundImage: 'url(/atlas/broca-do-cafe-1.jpg)' }} />
              <span style={{ backgroundImage: 'url(/atlas/cercosporiose-2.jpg)' }} />
              <span style={{ backgroundImage: 'url(/atlas/bicho-mineiro-4.jpg)' }} />
            </div>
            <div className="ac-vitrine-selo"><b>Sem custo para você</b><small>Cursos e aulas do seu escritório</small></div>
            <Link className="ac-btn ac-btn-ouro" href={destaque ? '/academy/cursos' : '/academy/atlas'}>{destaque ? 'Ver os cursos' : 'Conhecer o Atlas'}</Link>
          </div>
        </div>
      </section>

      <section className="ac-busca-faixa" aria-label="Buscar">
        <form className="ac-busca-grande" action="/academy/cursos" method="get" role="search">
          <input name="q" type="search" placeholder="Busque: calagem, café, adubação…" aria-label="Buscar cursos e aulas" autoComplete="off" />
          <button type="submit">Buscar</button>
        </form>
        <p>Procurando uma praga ou doença? <Link href="/academy/atlas">Busque no Atlas</Link></p>
      </section>

      {vazio ? (
        <div className="ac-principal">
          <div className="ac-vazio">
            <b>A Academy do seu escritório ainda não tem cursos</b>
            Quando o seu agrônomo publicar o primeiro curso ou indicar uma aula, ele aparece aqui — e você recebe um aviso. Enquanto isso, o <Link href="/academy/atlas">Atlas de doenças e pragas</Link> já está disponível.
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

      {destaque ? (
        <section className="ac-secao" aria-label="Curso em destaque">
          <Link className="ac-banner-destaque" href={`/academy/cursos/${destaque.id}`} style={{ background: fundoDaCapa(destaque.tema) }}>
            <span className="ac-capa-simbolo" aria-hidden="true">{capaDoTema(destaque.tema).simbolo}</span>
            <div className="ac-banner-texto">
              <span className="ac-banner-etiqueta">Curso em destaque</span>
              <h2>{destaque.titulo}</h2>
              {destaque.resumo || destaque.descricao ? <p>{destaque.resumo ?? destaque.descricao}</p> : null}
              <span className="ac-btn ac-btn-ouro">Explorar o curso</span>
            </div>
            <div className="ac-banner-capa" aria-hidden="true"><CapaCurso tema={destaque.tema} titulo={destaque.titulo} capaUrl={destaque.capa_url} /></div>
          </Link>
        </section>
      ) : null}

      <section className="ac-secao" aria-labelledby="t-formatos">
        <header className="ac-secao-cabecalho"><div><h2 id="t-formatos">Como você quer aprender?</h2><p>Escolha o formato que cabe no seu dia.</p></div></header>
        <div className="ac-formatos">
          {formatos.map(({ href, Icone, titulo, n, unidade, texto }) => (
            <Link key={href} className="ac-formato" href={href}>
              <span className="ac-formato-icone"><Icone /></span>
              <b>{titulo}</b>
              <small>{texto}</small>
              <span className="ac-formato-n">{n} {n === 1 ? unidade[0] : unidade[1]}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ac-secao" aria-label="Novidade">
        <div className="ac-novidade">
          <div>
            <span className="ac-banner-etiqueta">Novidade</span>
            <h2>Atlas de doenças e pragas</h2>
            <p>Viu uma mancha na folha ou um bicho que você não conhece? Compare com as fichas, que trazem fotos, o que favorece o problema e como monitorar — e peça ajuda ao seu técnico direto da ficha.</p>
            <Link className="ac-btn ac-btn-escuro" href="/academy/atlas">Conhecer o Atlas</Link>
          </div>
          <div className="ac-novidade-fotos" aria-hidden="true">
            <span style={{ backgroundImage: 'url(/atlas/escaldadura-1.jpg)' }} />
            <span style={{ backgroundImage: 'url(/atlas/cochonilha-da-roseta-2.jpg)' }} />
            <span style={{ backgroundImage: 'url(/atlas/lagarta-dos-cafezais-1.jpg)' }} />
          </div>
        </div>
      </section>

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
          <header className="ac-secao-cabecalho"><div><h2>Aulas e materiais avulsos</h2><p>Para ver quando quiser, sem precisar fazer um curso inteiro.</p></div><Link href="/academy/biblioteca">Ver todos →</Link></header>
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
