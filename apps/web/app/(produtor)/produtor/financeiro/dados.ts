import { notFound } from 'next/navigation';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { hojeISO as dataDeHoje } from '@/lib/formato';
import { statusEfetivo } from '@/lib/financeiro';
import { temFeature } from '@/lib/planos';

export type Categoria = { id: string; nome: string; tipo: 'receita' | 'despesa'; padrao: boolean };
export type CentroCusto = { id: string; nome: string; propriedade_id: string | null; talhao_id: string | null };
export type Conta = { id: string; nome: string; tipo: string; saldo_inicial: number };
export type Lancamento = {
  id: string; conta_id: string | null; categoria_id: string | null; propriedade_id: string | null; talhao_id: string | null;
  tipo: 'receita' | 'despesa'; descricao: string; valor: number; data: string; vencimento: string | null;
  status: string; comprovante_path: string | null; observacao: string | null;
};
export type Orcamento = { id: string; categoria_id: string | null; valor_planejado: number };

export async function carregarFinanceiro() {
  const produtor = await produtorAtual();

  if (!produtor) notFound();

  const sb = await criarClienteServidor();

  // plano sem financeiro: quem chama decide o que mostrar (aqui só o motivo)
  if (!(await temFeature(sb, 'financeiro'))) return { bloqueado: true as const };

  await sb.schema('agro').rpc('semear_categorias_financeiras', { p_produtor: produtor.id });

  const [
    { data: categoriasRaw }, { data: centrosRaw }, { data: contasRaw }, { data: lancamentosRaw },
    { data: orcamentosRaw }, { data: propriedadesRaw }, { data: talhoesRaw },
  ] = await Promise.all([
    sb.schema('agro').from('financeiro_categorias').select('id, nome, tipo, padrao').order('nome'),
    sb.schema('agro').from('financeiro_centros_custo').select('id, nome, propriedade_id, talhao_id').order('nome'),
    sb.schema('agro').from('financeiro_contas').select('id, nome, tipo, saldo_inicial').order('nome'),
    sb.schema('agro').from('financeiro_lancamentos')
      .select('id, conta_id, categoria_id, propriedade_id, talhao_id, tipo, descricao, valor, data, vencimento, status, comprovante_path, observacao')
      .order('data', { ascending: false })
      .limit(300),
    sb.schema('agro').from('financeiro_orcamentos').select('id, categoria_id, valor_planejado').order('criado_em'),
    sb.schema('agro').from('propriedades').select('id, nome').order('nome'),
    sb.schema('agro').from('talhoes').select('id, nome, propriedade_id').order('nome'),
  ]);

  const categorias = (categoriasRaw ?? []) as Categoria[];

  const centros = (centrosRaw ?? []) as CentroCusto[];

  const contas = (contasRaw ?? []) as Conta[];

  const lancamentos = (lancamentosRaw ?? []) as Lancamento[];

  const orcamentos = (orcamentosRaw ?? []) as Orcamento[];

  const propriedades = (propriedadesRaw ?? []) as Array<{ id: string; nome: string }>;

  const talhoes = (talhoesRaw ?? []) as Array<{ id: string; nome: string; propriedade_id: string }>;

  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? '—';

  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—';

  const comprovantes = lancamentos.filter((l) => l.comprovante_path).map((l) => l.comprovante_path!) as string[];

  const { data: assinadas } = comprovantes.length
  ? await sb.storage.from('financeiro').createSignedUrls(comprovantes, 3600)
  : { data: [] as Array<{ path: string | null; signedUrl: string }> };

  const urlComprovante = new Map<string, string | null>((assinadas ?? []).map((a) => [a.path ?? '', a.signedUrl]));

  const hojeISO = dataDeHoje();

  const mesAtual = hojeISO.slice(0, 7);

  const anoAtual = hojeISO.slice(0, 4);

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
    centros,
    contas,
    lancamentos,
    orcamentos,
    propriedades,
    talhoes,
    nomeCategoria,
    nomeConta,
    urlComprovante,
    hojeISO,
    anoAtual,
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
export type ContextoFinanceiro = Exclude<Awaited<ReturnType<typeof carregarFinanceiro>>, { bloqueado: true }>;
