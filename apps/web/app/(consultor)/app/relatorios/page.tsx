import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { nomeCultura } from '@/lib/culturas';
import { f, dataBR } from '@/lib/formato';
import { temFeature } from '@/lib/planos';
import { Cartao } from '@/components/ui';
import { BotaoImprimir } from '@/components/botao-imprimir';
import { PrecisaUpgrade } from '@/components/precisa-upgrade';

export const dynamic = 'force-dynamic';

export default async function Relatorios() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();

  if (!(await temFeature(sb, 'relatorios_avancados'))) {
    return (
      <PrecisaUpgrade
        titulo="Relatórios"
        descricao="Relatório A4 imprimível e exportação em CSV de toda a carteira."
        href="/app/assinatura"
      />
    );
  }

  const [{ data: org }, { data: situacaoRaw }] = await Promise.all([
    perfil?.org_id ? sb.schema('agro').from('orgs').select('nome').eq('id', perfil.org_id).single() : Promise.resolve({ data: null }),
    sb.schema('agro').from('vw_talhao_situacao').select('cultura, area_ha, situacao'),
  ]);

  const situacao = (situacaoRaw ?? []) as Array<{ cultura: string | null; area_ha: number | null; situacao: string }>;
  const areaTotal = situacao.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const foraDaMeta = situacao.filter((t) => t.situacao === 'precisa_correcao').length;
  const semAnalise = situacao.filter((t) => t.situacao === 'sem_analise').length;

  const porCultura = new Map<string, number>();
  for (const t of situacao) {
    const chave = t.cultura ?? '__sem';
    porCultura.set(chave, (porCultura.get(chave) ?? 0) + Number(t.area_ha ?? 0));
  }
  const culturasOrdenadas = [...porCultura.entries()].sort((a, b) => b[1] - a[1]);

  const hoje = dataBR(new Date().toISOString().slice(0, 10));

  return (
    <>
      <div className="cabecalho-vista nao-imprime">
        <div>
          <span className="olho">Sua carteira</span>
          <h1>Relatórios</h1>
          <p>Um resumo pronto pra imprimir ou salvar em PDF, e a exportação em planilha de toda a carteira.</p>
        </div>
        <div className="acoes">
          <Link className="btn sec" prefetch={false} href="/app/relatorios/carteira.csv">Baixar CSV</Link>
          <BotaoImprimir />
        </div>
      </div>

      <div className="folha-a4">
        <div className="cabecalho">
          <div>
            <h2 style={{ border: 0, padding: 0, margin: 0, fontSize: 22 }}>Relatório da carteira</h2>
            <div className="nota">{org?.nome ?? '—'} · gerado em {hoje}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <b>{perfil?.nome ?? '—'}</b><br />
            {perfil?.crea ? `CREA ${perfil.crea}` : ''}
          </div>
        </div>

        <h2>1. Visão geral</h2>
        <table>
          <tbody>
            <tr><td><b>Talhões acompanhados</b></td><td>{situacao.length}</td><td><b>Área total</b></td><td>{f(areaTotal, 1)} ha</td></tr>
            <tr><td><b>Talhões fora da meta</b></td><td>{foraDaMeta}</td><td><b>Sem análise ainda</b></td><td>{semAnalise}</td></tr>
          </tbody>
        </table>

        <h2>2. Área por cultura</h2>
        <table>
          <thead>
            <tr><th>Cultura</th><th className="num">Área</th><th className="num">% da carteira</th></tr>
          </thead>
          <tbody>
            {culturasOrdenadas.map(([c, area]) => (
              <tr key={c}>
                <td>{nomeCultura(c === '__sem' ? null : c)}</td>
                <td className="num">{f(area, 1)} ha</td>
                <td className="num">{areaTotal > 0 ? f((100 * area) / areaTotal, 0) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="nota" style={{ marginTop: 20 }}>
          Números agregados de toda a carteira — detalhe por talhão em <b>Inteligência</b>, dentro do app.
        </p>
      </div>

      <Cartao olho="Também disponível" titulo="Planilha da carteira" className="nao-imprime" style={{ marginTop: 14 }}>
        <p className="nota" style={{ margin: '0 0 10px' }}>
          CSV com um talhão por linha: cultura, área, última coleta, saturação por bases, saturação por
          alumínio e situação — pronto pra abrir no Excel/Sheets.
        </p>
        <Link className="btn verde mini" prefetch={false} href="/app/relatorios/carteira.csv">Baixar CSV</Link>
      </Cartao>
    </>
  );
}
