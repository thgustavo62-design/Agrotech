import { CabecalhoVista, Vazio } from '@/components/ui';
import { AtualizarAtePronto } from '@/components/atualizar-ate-pronto';
import { descartarLaudo } from '../acoes';
import type { Documento } from '../dados';

/** OCR em segundo plano: a página se atualiza sozinha até o resultado chegar. */
export function Lendo({ id, doc }: { id: string; doc: Documento }) {
  return (
    <>
      <CabecalhoVista
        olho="Conferência"
        titulo={doc.nome_arquivo}
        descricao="Lendo o PDF escaneado (OCR)… leva cerca de 30 segundos. Esta página se atualiza sozinha."
        acoes={
          <form action={descartarLaudo}>
            <input type="hidden" name="documento_id" value={id} />
            <button className="btn perigo mini" type="submit">Descartar laudo</button>
          </form>
        }
      />
      <AtualizarAtePronto />
      <Vazio titulo="Lendo o laudo…">
        Se passar de 2 minutos, descarte e envie de novo — a leitura pode ter sido interrompida.
      </Vazio>
    </>
  );
}
