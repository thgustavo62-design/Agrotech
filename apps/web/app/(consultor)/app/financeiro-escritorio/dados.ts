import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { hojeISO as dataDeHoje } from '@/lib/formato';
import { statusEfetivo } from '@/lib/financeiro';
import { temFeature } from '@/lib/planos';

export type Categoria = { id: string; nome: string; tipo: 'receita' | 'despesa'; padrao: boolean };
export type Conta = { id: string; nome: string; tipo: string; saldo_inicial: number };
export type Lancamento = {
  id: string; conta_id: string | null; categoria_id: string | null; produtor_id: string | null;
  tipo: 'receita' | 'despesa'; descricao: string; valor: number; data: string; vencimento: string | null;
  status: string; comprovante_path: string | null; observacao: string | null;
};

export async function carregarFinanceiroEscritorio() {
  const perfil = await perfilAtual();

  const sb = await criarClienteServidor();

  // plano sem financeiro: quem chama decide o que mostrar (aqui só o motivo)
  if (!perfil?.org_id || !(await temFeature(sb, 'financeiro'))) return { bloqueado: true as const };

  await sb.schema('agro').rpc('semear_categorias_financeiras_escritorio', { p_org: perfil.org_id });

  const [
    { data: categoriasRaw }, { data: contasRaw }, { data: lancamentosRaw }, { data: produtoresRaw },
  ] = await Promise.all([
    sb.schema('agro').from('financeiro_escrit_categorias').select('id, nome, tipo, padrao').order('nome'),
    sb.schema('agro').from('financeiro_escrit_contas').select('id, nome, tipo, saldo_inicial').order('nome'),
    sb.schema('agro').from('financeiro_escrit_lancamentos')
      .select('id, conta_id, categoria_id, produtor_id, tipo, descricao, valor, data, vencimento, status, comprovante_path, observacao')
      .order('data', { ascending: false })
      .limit(300),
    sb.schema('agro').from('produtores').select('id, nome').order('nome'),
  ]);

  const categorias = (categoriasRaw ?? []) as Categoria[];

  const contas = (contasRaw ?? []) as Conta[];

  const lancamentos = (lancamentosRaw ?? []) as Lancamento[];

  const produtores = (produtoresRaw ?? []) as Array<{ id: string; nome: string }>;

  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? '—';

  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—';

  const nomeProdutor = (id: string | null) => produtores.find((p) => p.id === id)?.nome ?? null;

  const comprovantes = lancamentos.filter((l) => l.comprovante_path).map((l) => l.comprovante_path!) as string[];

  const { data: assinadas } = comprovantes.length
  ? await sb.storage.from('financeiro-escritorio').createSignedUrls(comprovantes, 3600)
  : { data: [] as Array<{ path: string | null; signedUrl: string }> };

  const urlComprovante = new Map<string, string | null>((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));

  const hojeISO = dataDeHoje();

  const mesAtual = hojeISO.slice(0, 7);

  const comStatus = lancamentos.map((l) => ({ ...l, statusEf: statusEfetivo(l.status, l.vencimento, hojeISO) }));

  const totalContas = contas.reduce((s, c) => s + Number(c.saldo_inicial), 0);

  const totalReceitasPagas = lancamentos.filter((l) => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const totalDespesasPagas = lancamentos.filter((l) => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const saldoGeral = totalContas + totalReceitasPagas - totalDespesasPagas;

  const saldoConta = (contaId: string, saldoInicial: number) => {
    const rec = lancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago' && l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
    const desp = lancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago' && l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
    return saldoInicial + rec - desp;
  };

  const doMes = lancamentos.filter((l) => l.data.slice(0, 7) === mesAtual);

  const receitasMes = doMes.filter((l) => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const despesasMes = doMes.filter((l) => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const despesaPorCategoriaMes = new Map<string, number>();

  for (const l of doMes) {
    if (l.tipo !== 'despesa' || l.status !== 'pago') continue;
    const chave = l.categoria_id ?? '__sem';
    despesaPorCategoriaMes.set(chave, (despesaPorCategoriaMes.get(chave) ?? 0) + Number(l.valor));
  }

  const despesasCategoriaOrdenadas = [...despesaPorCategoriaMes.entries()].sort((a, b) => b[1] - a[1]);

  const atrasados = comStatus.filter((l) => l.statusEf === 'atrasado').sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''));

  const proximosVencimentos = comStatus
  .filter((l) => l.status === 'pendente' && l.vencimento && l.vencimento >= hojeISO)
  .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!))
  .slice(0, 5);

  const pendenciasTotal = comStatus.filter((l) => l.statusEf === 'pendente' || l.statusEf === 'atrasado').length;

  const categoriasReceita = categorias.filter((c) => c.tipo === 'receita');

  const categoriasDespesa = categorias.filter((c) => c.tipo === 'despesa');

  return {
    bloqueado: false as const,
    categorias,
    contas,
    lancamentos,
    produtores,
    nomeCategoria,
    nomeConta,
    nomeProdutor,
    urlComprovante,
    hojeISO,
    comStatus,
    saldoGeral,
    saldoConta,
    receitasMes,
    despesasMes,
    despesasCategoriaOrdenadas,
    atrasados,
    proximosVencimentos,
    pendenciasTotal,
    categoriasReceita,
    categoriasDespesa,
  };
}

/** Contexto das abas: o resultado do carregador sem o caso "bloqueado". */
export type ContextoFinanceiroEscritorio = Exclude<Awaited<ReturnType<typeof carregarFinanceiroEscritorio>>, { bloqueado: true }>;
