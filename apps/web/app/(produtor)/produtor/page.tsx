import Link from 'next/link';
import { criarClienteServidor, produtorAtual, perfilAtual } from '@/lib/supabase/server';
import { f, dataBR, moeda } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { resumoFinanceiro } from '@/lib/financeiro';
import { ROTULO_STATUS_DOCUMENTO } from '@/lib/documentos';
import { temFeature } from '@/lib/planos';
import { Cartao, Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_PRODUTOR } from '@/components/banner-hero';
import { IconeTalhoes, IconeRecomendacoes } from '@/components/icones';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  precisa_correcao: { txt: 'precisa de correção', tom: 'ruim' },
  em_ordem: { txt: 'solo em ordem', tom: 'ok' },
  sem_analise: { txt: 'sem análise ainda', tom: 'cinza' },
};

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()),
  );
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default async function PainelProdutor() {
  const sb = await criarClienteServidor();
  const [perfil, produtor] = await Promise.all([perfilAtual(), produtorAtual()]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const financeiroHabilitado = await temFeature(sb, 'financeiro');
  const [{ data: talhoes }, { data: recs }, { data: docsRaw }, { data: eventosRaw }, resumoFin] = await Promise.all([
    sb.schema('agro').from('vw_talhao_situacao')
      .select('talhao_id, nome, cultura, area_ha, data_coleta, situacao')
      .order('nome'),
    sb.schema('agro').from('recomendacoes')
      .select('id, emitida_em, analise:analise_id(talhao:talhao_id(nome, cultura))')
      .is('arquivada_em', null)
      .order('emitida_em', { ascending: false })
      .limit(3),
    sb.schema('agro').from('documentos')
      .select('id, nome_arquivo, laboratorio, status, criado_em')
      .order('criado_em', { ascending: false })
      .limit(3),
    sb.schema('agro').from('agenda_eventos')
      .select('id, titulo, data, tipo')
      .eq('status', 'planejado').gte('data', hojeISO)
      .order('data', { ascending: true }).limit(1),
    produtor && financeiroHabilitado ? resumoFinanceiro(sb, produtor.id) : Promise.resolve(null),
  ]);

  const lista = (talhoes ?? []) as Array<{
    talhao_id: string; nome: string; cultura: string | null;
    area_ha: number | null; data_coleta: string | null; situacao: string;
  }>;
  const recomendacoes = (recs ?? []) as unknown as Array<{
    id: string; emitida_em: string; analise: { talhao: { nome: string; cultura: string | null } | null } | null;
  }>;
  const documentos = (docsRaw ?? []) as Array<{
    id: string; nome_arquivo: string | null; laboratorio: string | null; status: string; criado_em: string;
  }>;
  const proximoEvento = ((eventosRaw ?? []) as Array<{ id: string; titulo: string; data: string; tipo: string }>)[0];

  const areaTotal = lista.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const culturas = [...new Set(lista.map((t) => t.cultura).filter((c): c is string => Boolean(c)))];
  const precisamCorrecao = lista.filter((t) => t.situacao === 'precisa_correcao');

  const hojeMenos14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const recomendacaoRecente = recomendacoes.find((r) => r.emitida_em >= hojeMenos14);
  const documentoRecente = documentos.find((d) => d.status === 'confirmado' && d.criado_em >= hojeMenos14);

  type Atencao = { chave: string; texto: string; href?: string };
  const atencao: Atencao[] = [
    ...precisamCorrecao.map((t): Atencao => ({
      chave: `talhao-${t.talhao_id}`,
      texto: `${t.nome} precisa de correção — fale com o seu técnico.`,
      href: '/produtor/talhoes',
    })),
    ...(recomendacaoRecente ? [{
      chave: `rec-${recomendacaoRecente.id}`,
      texto: `Seu agrônomo publicou uma nova recomendação para ${recomendacaoRecente.analise?.talhao?.nome ?? 'um talhão'}.`,
      href: `/produtor/laudos/${recomendacaoRecente.id}`,
    }] : []),
    ...(documentoRecente ? [{
      chave: `doc-${documentoRecente.id}`,
      texto: 'Há uma análise de solo nova disponível.',
      href: '/produtor/documentos',
    }] : []),
    ...(proximoEvento ? [{
      chave: `evento-${proximoEvento.id}`,
      texto: `${proximoEvento.tipo === 'visita' ? 'Visita técnica' : proximoEvento.titulo} marcada para ${dataBR(proximoEvento.data)}.`,
    }] : []),
  ];

  return (
    <>
      <BannerHero imagem={FOTO_PRODUTOR}
        olho="Sua lavoura"
        titulo={`${saudacao()}, ${perfil?.nome ?? 'produtor'}.`}
        descricao={
          <>
            {f(areaTotal, 1)} ha assistidos
            {culturas.length > 0 ? ` · ${culturas.map((c) => nomeCultura(c)).join(', ')}` : ''}
          </>
        }
        tags={['Solo', 'Safra', 'Resultado']}
      />

      <Grade cols={2} style={{ marginBottom: 14 }}>
        <Metrica rotulo="Talhões acompanhados" valor={lista.length} detalhe={`${f(areaTotal, 1)} ha`} icone={IconeTalhoes} />
        <Metrica rotulo="Recomendações recebidas" valor={recomendacoes.length} icone={IconeRecomendacoes} />
      </Grade>

      <Cartao olho="Fique de olho" titulo="Precisa da sua atenção">
        {atencao.length === 0 ? (
          <Vazio titulo="Nada pedindo atenção agora" />
        ) : (
          <div className="lista">
            {atencao.map((it) => (
              <div className="item" key={it.chave}>
                <div className="cresce"><p style={{ margin: 0 }}>{it.texto}</p></div>
                {it.href ? <Link className="btn sec mini" href={it.href}>ver</Link> : null}
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Grade cols={2} style={{ marginTop: 14, alignItems: 'start' }}>
        <Cartao olho="Histórico" titulo="Últimas recomendações">
          {recomendacoes.length === 0 ? (
            <Vazio titulo="Nenhuma recomendação ainda" />
          ) : (
            <div className="lista">
              {recomendacoes.map((r) => (
                <div className="item" key={r.id}>
                  <div className="cresce">
                    <h3>{r.analise?.talhao?.nome ?? 'Talhão'}</h3>
                    <small>{nomeCultura(r.analise?.talhao?.cultura ?? null)} · {dataBR(r.emitida_em.slice(0, 10))}</small>
                  </div>
                  <Link className="btn sec mini" href={`/produtor/laudos/${r.id}`}>abrir</Link>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao olho="Recebidos" titulo="Documentos recentes">
          {documentos.length === 0 ? (
            <Vazio titulo="Nenhum documento ainda" />
          ) : (
            <div className="lista">
              {documentos.map((d) => {
                const s = ROTULO_STATUS_DOCUMENTO[d.status] ?? { txt: d.status, tom: 'cinza' as const };
                return (
                  <div className="item" key={d.id}>
                    <div className="cresce">
                      <h3>{d.nome_arquivo ?? 'laudo.pdf'}</h3>
                      <small>{d.laboratorio ?? 'laboratório não identificado'} · {dataBR(d.criado_em.slice(0, 10))}</small>
                    </div>
                    <Tag tom={s.tom}>{s.txt}</Tag>
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>
      </Grade>

      {resumoFin && (
        <Cartao olho="Resumo financeiro" titulo={moeda(resumoFin.saldo)} style={{ marginTop: 14 }}>
          <p className="nota" style={{ margin: 0 }}>
            {resumoFin.pendencias > 0
              ? `${resumoFin.pendencias} lançamento(s) a vencer ou atrasado(s).`
              : 'Nenhum lançamento pendente.'}
          </p>
          <Link className="btn sec mini" href="/produtor/financeiro" style={{ marginTop: 10 }}>
            Abrir o financeiro
          </Link>
        </Cartao>
      )}

      <Cartao
        olho="Situação"
        titulo={precisamCorrecao.length > 0 ? `${precisamCorrecao.length} talhão(ões) pedem atenção` : 'Nenhum talhão pedindo correção'}
        style={{ marginTop: 14 }}
      >
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum talhão cadastrado">Fale com o seu técnico.</Vazio>
        ) : (
          <div className="lista">
            {lista.slice(0, 6).map((t) => {
              const e = ESTADO[t.situacao] ?? ESTADO.sem_analise!;
              return (
                <div className="item" key={t.talhao_id}>
                  <div className="cresce">
                    <h3>{t.nome}</h3>
                    <small>
                      {nomeCultura(t.cultura)} · {f(Number(t.area_ha ?? 0), 1)} ha
                      {t.data_coleta ? ` · análise de ${dataBR(t.data_coleta)}` : ''}
                    </small>
                  </div>
                  <Tag tom={e.tom}>{e.txt}</Tag>
                </div>
              );
            })}
          </div>
        )}
        {lista.length > 6 && (
          <Link className="btn sec mini" href="/produtor/talhoes" style={{ marginTop: 10 }}>Ver todos os talhões</Link>
        )}
        <p className="nota" style={{ marginTop: 12 }}>
          &ldquo;Precisa de correção&rdquo; significa que a saturação por bases está baixa ou o alumínio
          alto na última análise. Os números técnicos estão no laudo.
        </p>
      </Cartao>
    </>
  );
}
