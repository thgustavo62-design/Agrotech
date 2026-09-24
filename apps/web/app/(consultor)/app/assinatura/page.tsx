import { criarClienteServidor } from '@/lib/supabase/server';
import { f, dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Grade, Metrica, Tag } from '@/components/ui';
import { iniciarUpgrade } from './acoes';

export const dynamic = 'force-dynamic';

const ROTULO_STATUS: Record<string, { txt: string; tom: 'ok' | 'alerta' | 'ruim' | 'cinza' }> = {
  trial: { txt: 'período de teste', tom: 'alerta' },
  ativa: { txt: 'ativa', tom: 'ok' },
  suspensa: { txt: 'suspensa — pagamento em atraso', tom: 'ruim' },
  cancelada: { txt: 'cancelada', tom: 'ruim' },
};

export default async function Assinatura() {
  const sb = await criarClienteServidor();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [
    { data: ass }, { data: planos }, { data: cobrancas },
    { count: nProdutores }, { count: nTalhoes }, { count: nLaudosMes },
  ] = await Promise.all([
    sb.schema('agro').from('assinaturas').select('plano, status, trial_expira_em, atual_ate').maybeSingle(),
    sb.schema('agro').from('planos').select('*').order('ordem'),
    sb.schema('agro').from('cobrancas').select('gateway_id, valor, status, metodo, vencimento, pago_em, criado_em').order('criado_em', { ascending: false }).limit(6),
    sb.schema('agro').from('produtores').select('*', { count: 'exact', head: true }),
    sb.schema('agro').from('talhoes').select('*', { count: 'exact', head: true }),
    sb.schema('agro').from('documentos').select('*', { count: 'exact', head: true }).gte('criado_em', inicioMes.toISOString()),
  ]);

  const planoAtual = (planos ?? []).find((p) => p.id === ass?.plano);
  const st = ass ? ROTULO_STATUS[ass.status as string] ?? { txt: ass.status as string, tom: 'cinza' as const } : null;
  const checkoutConfigurado = Boolean(process.env.ASAAS_API_KEY);

  const Uso = ({ rot, usado, limite }: { rot: string; usado: number; limite?: number }) => {
    const pct = limite ? Math.min(100, Math.round((100 * usado) / limite)) : 0;
    const perto = limite ? usado / limite >= 0.8 : false;
    return (
      <Metrica
        rotulo={rot}
        valor={limite ? `${usado} / ${limite}` : usado}
        detalhe={limite ? `${pct}% do plano` : undefined}
        cor={perto ? 'var(--c-b)' : undefined}
      />
    );
  };

  return (
    <>
      <CabecalhoVista
        olho="Conta"
        titulo="Assinatura"
        descricao="Plano, uso e histórico de cobrança. A gestão de pagamento é feita pelo Asaas."
      />

      {ass ? (
        <Cartao olho="Plano atual" titulo={planoAtual?.nome ?? (ass.plano as string)}>
          <p style={{ margin: '0 0 12px' }}>
            {st && <Tag tom={st.tom}>{st.txt}</Tag>}{' '}
            {ass.status === 'trial' && ass.trial_expira_em && (
              <span className="nota">teste até {dataBR(String(ass.trial_expira_em).slice(0, 10))}</span>
            )}
            {ass.status === 'ativa' && ass.atual_ate && (
              <span className="nota">vigente até {dataBR(String(ass.atual_ate))}</span>
            )}
          </p>
          <Grade cols={3}>
            <Uso rot="Produtores" usado={nProdutores ?? 0} limite={planoAtual?.lim_produtores} />
            <Uso rot="Talhões" usado={nTalhoes ?? 0} limite={planoAtual?.lim_talhoes} />
            <Uso rot="Laudos neste mês" usado={nLaudosMes ?? 0} limite={planoAtual?.lim_laudos_mes} />
          </Grade>
          {(ass.status === 'suspensa' || ass.status === 'cancelada') && (
            <div className="aviso" style={{ marginTop: 12 }}>
              Cadastro de novos registros está bloqueado. Os dados existentes continuam acessíveis e podem
              ser exportados a qualquer momento.
            </div>
          )}
        </Cartao>
      ) : (
        <Cartao olho="Plano atual" titulo="Sem assinatura">
          <p className="nota">Nenhuma assinatura registrada para esta organização.</p>
        </Cartao>
      )}

      <Cartao olho="Planos" titulo="Disponíveis">
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Plano</th><th className="num">Mensal</th><th className="num">Produtores</th><th className="num">Talhões</th><th className="num">Laudos/mês</th><th /></tr>
            </thead>
            <tbody>
              {(planos ?? []).map((p) => (
                <tr key={p.id as string}>
                  <td>{p.nome as string} {p.id === ass?.plano ? <Tag>atual</Tag> : null}</td>
                  <td className="num">{Number(p.preco_mes) > 0 ? `R$ ${f(Number(p.preco_mes), 0)}` : '—'}</td>
                  <td className="num">{p.lim_produtores as number}</td>
                  <td className="num">{p.lim_talhoes as number}</td>
                  <td className="num">{p.lim_laudos_mes as number}</td>
                  <td className="num">
                    {p.id !== ass?.plano && Number(p.preco_mes) > 0 ? (
                      <form action={iniciarUpgrade}>
                        <input type="hidden" name="plano_id" value={p.id as string} />
                        <button className="btn verde mini" type="submit">Assinar</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!checkoutConfigurado && (
          <p className="nota" style={{ marginTop: 10 }}>
            O checkout automático (Asaas) ainda não está configurado neste ambiente — clicar em
            &ldquo;Assinar&rdquo; explica isso em vez de travar. Pra mudar de plano agora, fale com o suporte da Nova7.
          </p>
        )}
      </Cartao>

      {(cobrancas ?? []).length > 0 && (
        <Cartao olho="Histórico" titulo="Cobranças">
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Data</th><th className="num">Valor</th><th>Método</th><th>Status</th><th className="num">Vencimento</th></tr>
              </thead>
              <tbody>
                {(cobrancas ?? []).map((c) => (
                  <tr key={c.gateway_id as string}>
                    <td>{dataBR(String(c.criado_em).slice(0, 10))}</td>
                    <td className="num">{c.valor ? `R$ ${f(Number(c.valor), 2)}` : '—'}</td>
                    <td>{(c.metodo as string) ?? '—'}</td>
                    <td>{(c.status as string) ?? '—'}</td>
                    <td className="num">{c.vencimento ? dataBR(String(c.vencimento)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}
    </>
  );
}
