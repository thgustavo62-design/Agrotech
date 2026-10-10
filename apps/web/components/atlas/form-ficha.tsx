import {
  IMPORTANCIAS, PARTES, ROTULO_IMPORTANCIA, ROTULO_PARTE, ROTULO_TIPO_FICHA, TIPOS_DE_FICHA, textoDasLinhas, type FichaDoBanco,
} from '@/lib/atlas-escritorio';
import { salvarFicha, excluirFicha } from '@/app/(academy)/academy/estudio/atlas/acoes';

/**
 * Formulário da ficha do Atlas do escritório. Sem JavaScript no navegador: cada lista de texto é uma caixa com um item por
 * linha. A regra de verdade (validação, permissão, https, foto para publicar) roda no servidor e no banco.
 */
export function FormFicha({ ficha, nFotos, podeEditar }: { ficha: FichaDoBanco | null; nFotos: number; podeEditar: boolean }) {
  const status = ficha?.status ?? 'rascunho';
  const marcadas = new Set(ficha?.partes ?? []);

  return (
    <>
      <form action={salvarFicha}>
        {ficha ? <input type="hidden" name="id" value={ficha.id} /> : null}
        <fieldset disabled={!podeEditar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="campo">
            <label>O que é esta ficha?</label>
            <div className="opcoes-tipo" role="radiogroup" aria-label="Tipo da ficha">
              {TIPOS_DE_FICHA.map((t) => (
                <label key={t}>
                  <input type="radio" name="tipo" value={t} defaultChecked={(ficha?.tipo ?? 'doenca') === t} />
                  <b>{ROTULO_TIPO_FICHA[t]}</b>
                  {t === 'doenca' ? 'Fungo, bactéria, vírus, nematoide…' : t === 'praga' ? 'Inseto, ácaro, lagarta…' : 'Deficiência, distúrbio fisiológico…'}
                </label>
              ))}
            </div>
          </div>

          <div className="grade g2" style={{ marginTop: 14 }}>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="nome">Nome da ficha</label>
              <input id="nome" name="nome" defaultValue={ficha?.nome ?? ''} maxLength={120} required autoComplete="off" placeholder="Ex.: Mancha-de-phoma" />
            </div>
            <div className="campo">
              <label htmlFor="cientifico">Nome científico <span className="un">opcional</span></label>
              <input id="cientifico" name="cientifico" defaultValue={ficha?.cientifico ?? ''} maxLength={160} autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="outros_nomes">Outros nomes <span className="un">opcional, separados por vírgula</span></label>
              <input id="outros_nomes" name="outros_nomes" defaultValue={ficha?.outros_nomes ?? ''} maxLength={200} autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="cultura">Cultura <span className="un">opcional</span></label>
              <input id="cultura" name="cultura" defaultValue={ficha?.cultura ?? ''} maxLength={60} autoComplete="off" placeholder="café conilon, milho…" />
            </div>
            <div className="campo" />
            <div className="campo">
              <label htmlFor="importancia_campo">Importância no campo</label>
              <select id="importancia_campo" name="importancia_campo" defaultValue={ficha?.importancia_campo ?? ''}>
                <option value="">— não informar —</option>
                {IMPORTANCIAS.map((i) => <option key={i} value={i}>{ROTULO_IMPORTANCIA[i]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="importancia_viveiro">Importância no viveiro</label>
              <select id="importancia_viveiro" name="importancia_viveiro" defaultValue={ficha?.importancia_viveiro ?? ''}>
                <option value="">— não informar —</option>
                {IMPORTANCIAS.map((i) => <option key={i} value={i}>{ROTULO_IMPORTANCIA[i]}</option>)}
              </select>
            </div>
          </div>

          <div className="campo" style={{ marginTop: 14 }}>
            <label>Onde aparece na planta <span className="un">marque pelo menos uma para publicar</span></label>
            <div className="marcar-lista" role="group" aria-label="Onde aparece na planta">
              {PARTES.map((p) => (
                <label className="marcar-item" key={p}>
                  <input type="checkbox" name="partes" value={p} defaultChecked={marcadas.has(p)} /> {ROTULO_PARTE[p]}
                </label>
              ))}
            </div>
          </div>

          <p className="nota" style={{ margin: '16px 0 0' }}>Nas caixas abaixo, escreva <b>um item por linha</b> (até 12 linhas). Com as suas palavras, a partir do seu manual.</p>
          <div className="grade g2" style={{ marginTop: 8 }}>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="sobre">1 · O que é <span className="un">obrigatório para publicar</span></label>
              <textarea id="sobre" name="sobre" rows={5} defaultValue={textoDasLinhas(ficha?.sobre)} placeholder="Como reconhecer, em que fase da planta aparece, o dano que causa…" />
            </div>
            <div className="campo">
              <label htmlFor="favorecem">2 · O que favorece</label>
              <textarea id="favorecem" name="favorecem" rows={5} defaultValue={textoDasLinhas(ficha?.favorecem)} placeholder="Clima, época, manejo, solo…" />
            </div>
            <div className="campo">
              <label htmlFor="manejo">3 · Como manejar <span className="un">sem produto nem dose</span></label>
              <textarea id="manejo" name="manejo" rows={5} defaultValue={textoDasLinhas(ficha?.manejo)} placeholder="Práticas culturais, monitoramento, quando chamar o técnico…" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="monitoramento">4 · Como monitorar <span className="un">opcional</span></label>
              <textarea id="monitoramento" name="monitoramento" rows={3} defaultValue={textoDasLinhas(ficha?.monitoramento)} placeholder="Amostragem, nível de controle…" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="confunde">Pode ser confundida com <span className="un">opcional</span></label>
              <input id="confunde" name="confunde" defaultValue={ficha?.confunde ?? ''} maxLength={500} autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="fonte">Apoio / fonte <span className="un">opcional — respeite os direitos do autor</span></label>
              <input id="fonte" name="fonte" defaultValue={ficha?.fonte ?? ''} maxLength={300} autoComplete="off" placeholder="Ex.: manual técnico do escritório" />
            </div>
            <div className="campo">
              <label htmlFor="url">Link do material <span className="un">opcional, começa com https://</span></label>
              <input id="url" name="url" type="url" inputMode="url" defaultValue={ficha?.url ?? ''} placeholder="https://" autoComplete="off" />
            </div>
          </div>
        </fieldset>

        {podeEditar ? (
          <div className="acoes-form">
            {status === 'rascunho' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="publicar" disabled={nFotos === 0}>Publicar</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Salvar rascunho</button>
              </>
            ) : null}
            {status === 'publicado' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="salvar">Salvar alterações</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Voltar a rascunho</button>
                <button className="btn sec" type="submit" name="intencao" value="arquivar">Arquivar</button>
              </>
            ) : null}
            {status === 'arquivado' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="publicar">Publicar de novo</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Voltar a rascunho</button>
              </>
            ) : null}
          </div>
        ) : null}
        {podeEditar && ficha && nFotos === 0 && status !== 'publicado' ? <p className="nota">Para publicar, primeiro salve e adicione ao menos uma foto (mais abaixo).</p> : null}
        {podeEditar && !ficha ? <p className="nota">Depois de salvar o rascunho você adiciona as fotos e publica.</p> : null}
      </form>

      {podeEditar && ficha ? (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--grafite)' }}>Excluir esta ficha</summary>
          <form action={excluirFicha} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={ficha.id} />
            <p className="nota" style={{ margin: '0 0 8px' }}>Apaga a ficha e as fotos dela. Para só tirar do ar, use <b>Arquivar</b>.</p>
            <button className="btn perigo mini" type="submit">Confirmar exclusão</button>
          </form>
        </details>
      ) : null}
    </>
  );
}
