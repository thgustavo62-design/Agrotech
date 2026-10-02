import { CabecalhoVista } from '@/components/ui';
import { confirmarLaudo, descartarLaudo } from '../acoes';
import type { DadosConferencia } from '../dados';
import { ResumoDoLaudo } from './ResumoDoLaudo';
import { SeletorDeAmostras } from './SeletorDeAmostras';
import { PdfOriginal } from './PdfOriginal';
import { CadastroAssistido } from './CadastroAssistido';
import { DadosDaColeta } from './DadosDaColeta';
import { ParametrosExtraidos } from './ParametrosExtraidos';

/** Conferência lado a lado: PDF original | formulário com o que foi extraído. */
export function Conferencia({
  id, doc, urlPdf, talhoes, extracao, amostras, multi, confirmadas, atual, campos, extras, ident, candidatos,
}: Extract<DadosConferencia, { tipo: 'revisao' }>) {
  return (
    <>
      <CabecalhoVista
        olho="Conferência"
        titulo={doc.nome_arquivo}
        descricao="Confira os campos extraídos (destacados quando a confiança é baixa), escolha o talhão e confirme."
        acoes={
          <form action={descartarLaudo}>
            <input type="hidden" name="documento_id" value={id} />
            <button className="btn perigo mini" type="submit">Descartar laudo</button>
          </form>
        }
      />

      {doc.erro ? <div className="aviso" style={{ marginBottom: 14 }}>{doc.erro}</div> : null}

      {extracao && <ResumoDoLaudo extracao={extracao} atual={atual} />}

      {multi && <SeletorDeAmostras id={id} amostras={amostras} atual={atual} confirmadas={confirmadas} />}

      <div className="grade g2" style={{ alignItems: 'start' }}>
        <PdfOriginal urlPdf={urlPdf} />

        <form action={confirmarLaudo}>
          <input type="hidden" name="documento_id" value={id} />
          <input type="hidden" name="total_amostras" value={multi ? amostras.length : 1} />
          {multi && atual ? <input type="hidden" name="amostra_indice" value={atual.indice} /> : null}
          <CadastroAssistido produtorNoLaudo={ident.produtor} talhoes={talhoes} candidatos={candidatos} />
          <DadosDaColeta dataNoLaudo={ident.data} laboratorio={doc.laboratorio} />
          <ParametrosExtraidos campos={campos} extras={extras} />

          {extracao?.avisos?.length ? (
            <div className="aviso" style={{ marginBottom: 14 }}>
              {extracao.avisos.map((a, i) => <div key={i}>{a}</div>)}
            </div>
          ) : null}

          <div className="barra-acao">
            <button className="btn verde" type="submit">
              {multi && atual ? `Confirmar amostra ${atual.indice} de ${amostras.length}` : 'Confirmar e interpretar'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
