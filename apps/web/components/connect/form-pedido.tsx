import { AJUDA_CATEGORIA, CATEGORIAS, ROTULO_CATEGORIA, type CategoriaPedido } from '@/lib/connect';
import type { MembroDaEquipe, OpcaoPropriedade, OpcaoTalhao } from '@/lib/connect-dados';
import { criarPedido } from '@/app/(connect)/connect/acoes';
import { CampoAnexos } from './campo-anexos';
import { BotaoEnviar } from './botao-enviar';

/**
 * Formulário do pedido. Serve ao produtor (pede ajuda) e à equipe (abre em nome de um produtor: aí chegam `produtorId`,
 * a lista da equipe e os campos de prioridade/responsável/prazo). Sem JavaScript no navegador além do anexo de fotos.
 */
export function FormPedido({
  propriedades, talhoes, categoriaInicial = 'duvida', produtorId, equipe,
}: {
  propriedades: OpcaoPropriedade[];
  talhoes: OpcaoTalhao[];
  categoriaInicial?: CategoriaPedido;
  produtorId?: string;
  equipe?: MembroDaEquipe[];
}) {
  const nomeProp = new Map(propriedades.map((p) => [p.id, p.nome]));
  return (
    <form action={criarPedido} className="cn-forma">
      {produtorId ? <input type="hidden" name="produtor_id" value={produtorId} /> : null}

      <fieldset className="cn-categorias">
        <legend className="cn-rotulo">Do que se trata?</legend>
        {CATEGORIAS.map((c) => (
          <label key={c} className="cn-categoria">
            <input type="radio" name="categoria" value={c} defaultChecked={c === categoriaInicial} />
            <span><b>{ROTULO_CATEGORIA[c]}</b><small>{AJUDA_CATEGORIA[c]}</small></span>
          </label>
        ))}
      </fieldset>

      <label className="cn-rotulo">
        Assunto
        <input name="assunto" required minLength={3} maxLength={160} placeholder="Ex.: folhas amareladas no talhão da frente" autoComplete="off" />
      </label>

      <label className="cn-rotulo">
        Conte com mais detalhes <span className="cn-opcional">(opcional)</span>
        <textarea name="descricao" rows={5} maxLength={4000} placeholder="Desde quando, onde, o que já foi feito…" />
      </label>

      {propriedades.length > 0 ? (
        <div className="cn-duas">
          <label className="cn-rotulo">
            Propriedade <span className="cn-opcional">(opcional)</span>
            <select name="propriedade_id" defaultValue="">
              <option value="">Não sei / não se aplica</option>
              {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="cn-rotulo">
            Talhão <span className="cn-opcional">(opcional)</span>
            <select name="talhao_id" defaultValue="">
              <option value="">Não sei / não se aplica</option>
              {talhoes.map((t) => <option key={t.id} value={t.id}>{nomeProp.get(t.propriedade_id) ?? '—'} · {t.nome} ({t.cultura})</option>)}
            </select>
          </label>
        </div>
      ) : null}

      <CampoAnexos rotulo={equipe ? 'Fotos ou PDF' : 'Fotos'} permitirPdf={Boolean(equipe)} />

      {equipe ? (
        <div className="cn-duas">
          <label className="cn-rotulo">
            Responsável
            <select name="responsavel_id" defaultValue="">
              <option value="">Sem responsável (cai na fila)</option>
              {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
          <label className="cn-rotulo">
            Prioridade
            <select name="prioridade" defaultValue="normal">
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="cn-rotulo">
            Prazo <span className="cn-opcional">(opcional)</span>
            <input type="date" name="vencimento" />
          </label>
        </div>
      ) : (
        <label className="cn-marcar"><input type="checkbox" name="urgente" /> É urgente <span className="nota">(a lavoura está em risco agora)</span></label>
      )}

      <div><BotaoEnviar>{equipe ? 'Abrir atendimento' : 'Enviar pedido'}</BotaoEnviar></div>
    </form>
  );
}
