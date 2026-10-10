import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import type { Metadata } from 'next';
import { exigirConta } from '@/lib/guarda-de-site';
import { FICHAS, ehDoEscritorio, fichaPorSlug, fonteDaFicha, fotosDaFicha, type FichaAtlas } from '@/lib/atlas-base';
import { carregarFichaCompleta, carregarFichasPublicadas } from '@/lib/atlas-dados';
import { ROTULO_STATUS_FICHA, type FichaDoBanco } from '@/lib/atlas-escritorio';
import { GRUPOS_DE_PARTE, fichasParecidas, linksDePesquisa, noGrupo } from '@/lib/atlas';
import { pode } from '@/lib/permissoes';
import { linkPedirAjuda } from '@/lib/connect';
import { dominioDoLink } from '@/lib/academy';
import { lerContextoDeIndicacao } from '@/lib/atlas-indicacoes';
import { GaleriaAtlas } from '@/components/atlas/galeria';
import { CartaoFicha } from '@/components/atlas/cartao-ficha';
import { IndicarFicha, type IndicacaoLinha, type ProdutorOpcao } from '@/components/atlas/indicar-ficha';
import { Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = fichaPorSlug(slug);
  return { title: f ? `${f.nome} · Atlas · AgroTech Academy` : 'Atlas · AgroTech Academy' };
}

const nivel = (n: string): 'alta' | 'media' | 'baixa' => (/extrema|elevada|alta/i.test(n) ? 'alta' : /m[eé]dia|moderada/i.test(n) ? 'media' : 'baixa');

export default async function FichaDoAtlas({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ indicado?: string; indicar?: string; visita?: string; analise?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { indicado } = sp;
  const contexto = lerContextoDeIndicacao(sp);
  const { sb, perfil, ehAluno, ehEquipe } = await exigirConta('academy');

  let f: FichaAtlas | undefined = fichaPorSlug(slug);
  let bruta: FichaDoBanco | null = null;
  if (!f && UUID.test(slug)) {
    // ficha do escritório: a RLS entrega só o que a pessoa pode ver (produtor: só publicada)
    const c = await carregarFichaCompleta(sb, slug);
    if (c) { f = c.ficha; bruta = c.bruta; }
  }
  if (!f) notFound();

  const doEscritorio = ehDoEscritorio(f);
  const fotos = fotosDaFicha(f);
  const onde = GRUPOS_DE_PARTE.filter((g) => noGrupo(f!, g.id));
  const parecidas = fichasParecidas(f, [...FICHAS, ...(await carregarFichasPublicadas(sb))]);
  const podeEditar = ehEquipe && pode(perfil.perfis, 'academy.gerenciar');
  const situacao = bruta ? ROTULO_STATUS_FICHA[bruta.status] : null;
  const fonte = doEscritorio ? null : fonteDaFicha(f);

  // indicação: a equipe indica e acompanha; o produtor vê o recado e a abertura é registrada
  const publicada = !bruta || bruta.status === 'publicado';
  const coluna = doEscritorio ? 'ficha_id' : 'ficha_slug';
  const { data: dadosInd } = await sb.schema('agro').from('atlas_indicacoes')
    .select('id, produtor_id, mensagem, criado_em, aberto_em, produtor:produtor_id(nome)').eq(coluna, f.slug).order('criado_em', { ascending: false });
  type LinhaInd = { id: string; produtor_id: string; mensagem: string | null; criado_em: string; aberto_em: string | null; produtor: { nome: string } | { nome: string }[] | null };
  const indicacoes: IndicacaoLinha[] = ((dadosInd ?? []) as unknown as LinhaInd[]).map((i) => ({
    id: i.id, produtor_id: i.produtor_id, mensagem: i.mensagem, criado_em: i.criado_em, aberto_em: i.aberto_em,
    produtor: (Array.isArray(i.produtor) ? i.produtor[0]?.nome : i.produtor?.nome) ?? 'Produtor',
  }));
  const podeIndicar = ehEquipe && pode(perfil.perfis, 'academy.indicar') && publicada;
  let produtores: ProdutorOpcao[] = [];
  if (podeIndicar) {
    const { data: prod } = await sb.schema('agro').from('produtores').select('id, nome').order('nome').limit(1000);
    produtores = (prod ?? []) as ProdutorOpcao[];
  }
  const minhaIndicacao = ehAluno ? indicacoes[0] : undefined;
  if (minhaIndicacao && !minhaIndicacao.aberto_em) {
    const idIndicacao = minhaIndicacao.id;
    // marca que abriu depois de enviar a página (o banco grava a hora)
    after(async () => { await sb.schema('agro').from('atlas_indicacoes').update({ aberto_em: new Date().toISOString() }).eq('id', idIndicacao); });
  }

  return (
    <>
      <section className="ac-atlas-faixa">
        <div className="ac-atlas-faixa-interno">
          <p className="ac-migalha"><Link href="/academy">Academy</Link> / <Link href="/academy/atlas">Atlas</Link> / {f.nome}</p>
          <div className="ac-atlas-faixa-topo">
            <div>
              <span className="ac-atlas-selo ac-atlas-selo-solto" data-tipo={f.tipo}>{f.tipo === 'doenca' ? 'Doença' : 'Praga'}</span>
              {doEscritorio ? <span className="ac-atlas-selo ac-atlas-selo-solto ac-atlas-selo-escritorio">Do escritório</span> : null}
              <h1>{f.nome}</h1>
              <p className="ac-atlas-cientifico">
                {f.cientifico}{f.cientifico && f.outrosNomes?.length ? ' · ' : ''}{f.outrosNomes?.length ? `também chamada de ${f.outrosNomes.join(', ')}` : ''}
                {doEscritorio && f.cultura ? ` · ${f.cultura}` : ''}
              </p>
            </div>
            <div className="ac-atlas-acoes">
              {ehAluno && (!bruta || bruta.status === 'publicado') ? (
                <Link className="btn ac-atlas-cta" href={linkPedirAjuda({ assunto: `Suspeita de ${f.nome.toLowerCase()}`, categoria: 'problema_lavoura', origem: 'atlas' })}>
                  Suspeito disso na minha lavoura
                </Link>
              ) : null}
              {podeEditar && bruta ? <Link className="btn sec" href={`/academy/estudio/atlas/${bruta.id}`}>Editar no Estúdio</Link> : null}
            </div>
          </div>
          {minhaIndicacao ? (
            <p className="ac-atlas-rascunho"><Tag tom="ok">indicada para você</Tag> Seu agrônomo indicou esta ficha{minhaIndicacao.mensagem ? <>: “{minhaIndicacao.mensagem}”</> : '.'}</p>
          ) : null}
          {situacao && bruta && bruta.status !== 'publicado' ? (
            <p className="ac-atlas-rascunho"><Tag tom={situacao.tom}>{situacao.txt}</Tag> Só a equipe vê esta ficha. Os produtores só enxergam depois de publicada.</p>
          ) : null}
          <ul className="ac-atlas-fatos" aria-label="Resumo">
            <li data-nivel={nivel(f.importancia.campo)}><span>Importância no campo</span><b>{f.importancia.campo}</b></li>
            <li data-nivel={nivel(f.importancia.viveiro)}><span>Importância no viveiro</span><b>{f.importancia.viveiro}</b></li>
            <li><span>Onde aparece</span><b>{onde.map((g) => g.rotulo.replace(/^(Na|No) /, '')).join(' · ') || '—'}</b></li>
          </ul>
        </div>
      </section>

      <main className="ac-principal ac-atlas-pagina">
        <div className="ac-atlas-ficha">
          {fotos.length > 0 ? <GaleriaAtlas fotos={fotos} nome={f.nome} creditos={f.creditos} /> : <div className="ac-vazio"><b>Esta ficha ainda não tem fotos</b></div>}

          <div className="ac-atlas-texto">
            <section>
              <h2><span aria-hidden="true">1</span> O que é</h2>
              {f.sobre.map((p) => <p key={p}>{p}</p>)}
              {f.confunde ? <p className="ac-atlas-aviso"><b>Cuidado:</b> {f.confunde}</p> : null}
            </section>
            {f.favorecem.length > 0 ? (
              <section>
                <h2><span aria-hidden="true">2</span> O que favorece</h2>
                <ul>{f.favorecem.map((p) => <li key={p}>{p}</li>)}</ul>
              </section>
            ) : null}
            {f.manejo.length > 0 ? (
              <section>
                <h2><span aria-hidden="true">3</span> Como manejar</h2>
                <ul>{f.manejo.map((p) => <li key={p}>{p}</li>)}</ul>
                <p className="ac-atlas-aviso">Produto, dose e época de aplicação são decisão do seu agrônomo, com receituário.</p>
              </section>
            ) : null}
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
          {fonte ? (
            <>
              <p>
                {fonte.instituicao} — {fonte.autores}. <i>{fonte.titulo}</i>.{' '}
                <a href={fonte.url} target="_blank" rel="noopener noreferrer">Abrir o documento original</a>
              </p>
              <p className="nota">
                Reprodução com autorização da Embrapa, com fonte e autoria das fotos. As condições descritas são as da Amazônia: épocas,
                níveis e variedades podem ser diferentes no seu município. Quer ler mais?{' '}
                {linksDePesquisa(f.nome).map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 10 }}>{a.rotulo}</a>)}
              </p>
            </>
          ) : (
            <>
              <p>Ficha escrita pelo seu escritório de assistência técnica{f.fonteTexto ? <>, com apoio em: <i>{f.fonteTexto}</i></> : null}.{' '}
                {f.fonteUrl ? <a href={f.fonteUrl} target="_blank" rel="noopener noreferrer">Abrir o material ({dominioDoLink(f.fonteUrl)})</a> : null}
              </p>
              <p className="nota">Apoio ao reconhecimento do problema; o diagnóstico e a escolha do produto são do seu agrônomo.</p>
            </>
          )}
        </aside>

        {podeIndicar ? <IndicarFicha referencia={f.slug} produtores={produtores} indicacoes={indicacoes} jaIndicou={indicado === '1'} produtorInicial={contexto?.produtorId} visitaId={contexto?.visitaId} analiseId={contexto?.analiseId} /> : null}

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
