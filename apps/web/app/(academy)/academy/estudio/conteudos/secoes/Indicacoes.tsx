import { Cartao, Tag } from '@/components/ui';
import { dataBR } from '@/lib/formato';
import { ROTULO_SITUACAO, situacaoDaIndicacao } from '@/lib/academy';
import { desfazerIndicacao, indicar } from '../../acoes-indicacao';
import type { ProdutorOpcao } from './FormConteudo';

export interface IndicacaoLinha {
  id: string;
  produtor_id: string;
  produtor: string;
  mensagem: string | null;
  criado_em: string;
  aberto_em: string | null;
  concluido_em: string | null;
}

/**
 * Indicar um curso ou um conteúdo a produtores e acompanhar quem recebeu, abriu e concluiu.
 * Serve aos dois: `alvo.campo` diz se o que se indica é um conteúdo (`conteudo_id`) ou um curso (`curso_id`).
 */
export function Indicacoes({
  alvo, retorno, produtores, indicacoes, podeIndicar, preselecionado, visitaId, analiseId,
}: {
  alvo: { campo: 'conteudo_id' | 'curso_id'; id: string; rotulo: string };
  /** caminho para voltar depois de indicar/desfazer */
  retorno: string;
  produtores: ProdutorOpcao[];
  indicacoes: IndicacaoLinha[];
  podeIndicar: boolean;
  preselecionado?: string;
  visitaId?: string;
  analiseId?: string;
}) {
  const jaIndicados = new Set(indicacoes.map((i) => i.produtor_id));
  const disponiveis = produtores.filter((p) => !jaIndicados.has(p.id));
  const concluidas = indicacoes.filter((i) => i.concluido_em).length;

  return (
    <Cartao olho="Acompanhamento" titulo="Indicar a produtores">
      {podeIndicar ? (
        disponiveis.length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todos os seus produtores já receberam este {alvo.rotulo}.</p>
        ) : (
          <form action={indicar}>
            <input type="hidden" name={alvo.campo} value={alvo.id} />
            <input type="hidden" name="retorno" value={retorno} />
            {visitaId ? <input type="hidden" name="visita_id" value={visitaId} /> : null}
            {analiseId ? <input type="hidden" name="analise_id" value={analiseId} /> : null}
            <div className="campo">
              <label>Para quem <span className="un">{disponiveis.length} sem este {alvo.rotulo}</span></label>
              <div className="marcar-lista">
                {disponiveis.map((p) => (
                  <label className="marcar-item" key={p.id}>
                    <input type="checkbox" name="produtor_id" value={p.id} defaultChecked={p.id === preselecionado} /> {p.nome}
                  </label>
                ))}
              </div>
            </div>
            <div className="campo" style={{ marginTop: 10 }}>
              <label htmlFor="mensagem">Recado ao produtor <span className="un">opcional — aparece junto do aviso</span></label>
              <textarea id="mensagem" name="mensagem" rows={2} maxLength={600} placeholder="Ex.: Faça antes da nossa visita de quinta." />
            </div>
            <div className="acoes-form">
              <button className="btn verde" type="submit">Indicar</button>
            </div>
          </form>
        )
      ) : (
        <p className="nota" style={{ marginTop: 0 }}>Seu perfil não indica conteúdos. Peça ao agrônomo ou ao proprietário.</p>
      )}

      <h3 style={{ margin: '20px 0 8px', fontSize: 14 }}>
        Já indicado a {indicacoes.length} produtor(es){indicacoes.length > 0 ? ` · ${concluidas} concluiu` : ''}
      </h3>
      {indicacoes.length === 0 ? (
        <p className="nota" style={{ margin: 0 }}>Ninguém recebeu este {alvo.rotulo} ainda.</p>
      ) : (
        <div className="lista">
          {indicacoes.map((i) => {
            const s = ROTULO_SITUACAO[situacaoDaIndicacao(i)];
            return (
              <div className="item" key={i.id}>
                <div className="cresce">
                  <h3>{i.produtor}</h3>
                  <small>
                    Indicado em {dataBR(i.criado_em)}
                    {i.concluido_em ? ` · concluiu em ${dataBR(i.concluido_em)}` : i.aberto_em ? ` · abriu em ${dataBR(i.aberto_em)}` : ''}
                  </small>
                  {i.mensagem ? <p className="nota" style={{ margin: '4px 0 0' }}>“{i.mensagem}”</p> : null}
                </div>
                <Tag tom={s.tom}>{s.txt}</Tag>
                {podeIndicar ? (
                  <form action={desfazerIndicacao}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="retorno" value={retorno} />
                    <button className="btn sec mini" type="submit" title="Retira a indicação (o produtor deixa de ver na lista dele)">desfazer</button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Cartao>
  );
}
