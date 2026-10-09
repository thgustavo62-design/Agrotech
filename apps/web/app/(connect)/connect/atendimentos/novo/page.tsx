import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { carregarEquipe, carregarLocais } from '@/lib/connect-dados';
import { FormPedido } from '@/components/connect/form-pedido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Novo atendimento · AgroTech Connect' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A equipe abre um atendimento em nome de um produtor (ligação, WhatsApp, visita). Passo 1: escolher o produtor; passo 2: o pedido. */
export default async function NovoAtendimento({ searchParams }: { searchParams: Promise<{ produtor?: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.role === 'produtor') redirect('/connect');

  const { produtor } = await searchParams;
  const sb = await criarClienteServidor();
  const s = sb.schema('agro');

  let escolhido: { id: string; nome: string } | null = null;
  if (produtor && UUID.test(produtor)) {
    const { data } = await s.from('produtores').select('id, nome').eq('id', produtor).maybeSingle();
    escolhido = (data as { id: string; nome: string } | null) ?? null;
  }

  if (!escolhido) {
    const { data } = await s.from('produtores').select('id, nome').order('nome_norm').limit(1000);
    const lista = (data ?? []) as Array<{ id: string; nome: string }>;
    return (
      <main className="cn-principal cn-estreito">
        <p className="cn-migalha"><Link href="/connect/fila">Fila</Link> / Novo atendimento</p>
        <h1>Novo atendimento</h1>
        <p className="cn-sub">Para qual produtor é este atendimento?</p>
        {lista.length === 0 ? (
          <div className="vazio"><b>Nenhum produtor cadastrado</b><p>Cadastre o produtor na Assistência Técnica primeiro.</p></div>
        ) : (
          <form method="get" action="/connect/atendimentos/novo" className="cn-forma">
            <label className="cn-rotulo">
              Produtor
              <select name="produtor" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {lista.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <div><button className="btn verde" type="submit">Continuar</button></div>
          </form>
        )}
      </main>
    );
  }

  const [{ propriedades, talhoes }, equipe] = await Promise.all([carregarLocais(sb, escolhido.id), carregarEquipe(sb)]);
  return (
    <main className="cn-principal cn-estreito">
      <p className="cn-migalha"><Link href="/connect/fila">Fila</Link> / <Link href="/connect/atendimentos/novo">Novo atendimento</Link></p>
      <h1>Atendimento para {escolhido.nome}</h1>
      <p className="cn-sub">O produtor é avisado e acompanha pelo Connect. <Link href="/connect/atendimentos/novo">Trocar de produtor</Link></p>
      <FormPedido produtorId={escolhido.id} propriedades={propriedades} talhoes={talhoes} equipe={equipe} />
    </main>
  );
}
