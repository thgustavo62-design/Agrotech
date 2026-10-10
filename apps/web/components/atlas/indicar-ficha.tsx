import { dataBR } from '@/lib/formato';
import { Tag } from '@/components/ui';
import { indicarFicha, removerIndicacao } from '@/app/(academy)/academy/atlas/acoes';
import { BotaoEnviar } from '@/components/connect/botao-enviar';

export interface IndicacaoLinha { id: string; produtor_id: string; produtor: string; mensagem: string | null; criado_em: string; aberto_em: string | null }
export interface ProdutorOpcao { id: string; nome: string }

/** "Indicar a um produtor" (equipe): escolhe o produtor, escreve um recado e acompanha quem já abriu a ficha. */
export function IndicarFicha({ referencia, produtores, indicacoes, jaIndicou, produtorInicial, visitaId, analiseId }: {
  /** vindos do botão "Indicar ficha" de outra tela */
  produtorInicial?: string;
  visitaId?: string | null;
  analiseId?: string | null;
  /** slug (ficha-base) ou id (ficha do escritório) */
  referencia: string;
  produtores: ProdutorOpcao[];
  indicacoes: IndicacaoLinha[];
  jaIndicou?: boolean;
}) {
  const indicados = new Set(indicacoes.map((i) => i.produtor_id));
  const disponiveis = produtores.filter((p) => !indicados.has(p.id));
  const escolhido = produtorInicial ? produtores.find((p) => p.id === produtorInicial) : undefined;
  const escolhidoJaRecebeu = Boolean(escolhido && indicados.has(escolhido.id));

  return (
    <section className="ac-atlas-indicar" aria-labelledby="t-indicar">
      <h2 id="t-indicar">Indicar a um produtor</h2>
      {jaIndicou ? <p className="ac-atlas-ok" role="status">Indicação enviada. O produtor é avisado e a ficha aparece em &ldquo;Indicadas para você&rdquo;.</p> : null}
      {escolhidoJaRecebeu && escolhido ? <p className="nota">{escolhido.nome} já recebeu esta ficha (veja abaixo).</p> : null}
      {disponiveis.length === 0 ? (
        <p className="nota">{produtores.length === 0 ? 'Nenhum produtor cadastrado ainda.' : 'Todos os seus produtores já receberam esta ficha.'}</p>
      ) : (
        <form action={indicarFicha} className="ac-atlas-indicar-form">
          <input type="hidden" name="ficha" value={referencia} />
          {visitaId ? <input type="hidden" name="visita_id" value={visitaId} /> : null}
          {analiseId ? <input type="hidden" name="analise_id" value={analiseId} /> : null}
          <div className="campo">
            <label htmlFor="produtor_id">Produtor</label>
            <select id="produtor_id" name="produtor_id" required defaultValue={escolhido && !escolhidoJaRecebeu ? escolhido.id : ''}>
              <option value="" disabled>Escolha…</option>
              {disponiveis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="mensagem">Recado <span className="un">opcional</span></label>
            <textarea id="mensagem" name="mensagem" rows={2} maxLength={600} placeholder="Ex.: Dê uma olhada nesta ficha antes da nossa visita de quinta." />
          </div>
          <div><BotaoEnviar ocupado="Indicando…">Indicar ficha</BotaoEnviar></div>
        </form>
      )}

      {indicacoes.length > 0 ? (
        <ul className="ac-atlas-indicados" aria-label="Quem já recebeu">
          {indicacoes.map((i) => (
            <li key={i.id}>
              <div>
                <b>{i.produtor}</b>
                <small>indicada em {dataBR(i.criado_em.slice(0, 10))}{i.mensagem ? ` · “${i.mensagem}”` : ''}</small>
              </div>
              <Tag tom={i.aberto_em ? 'ok' : 'cinza'}>{i.aberto_em ? 'abriu' : 'ainda não abriu'}</Tag>
              <form action={removerIndicacao}>
                <input type="hidden" name="id" value={i.id} />
                <button className="btn sec mini" type="submit">Desfazer</button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
