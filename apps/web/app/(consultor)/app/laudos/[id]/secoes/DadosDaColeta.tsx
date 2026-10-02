import { Cartao } from '@/components/ui';
import { paraDataInput } from '@/lib/laudo-conferencia';

export function DadosDaColeta({ dataNoLaudo, laboratorio }: { dataNoLaudo: string | null | undefined; laboratorio: string | null }) {
  return (
    <Cartao olho="Coleta" titulo="Dados da amostra">
      <div className="grade g3">
        <div className="campo">
          <label htmlFor="data_coleta">Data da coleta</label>
          <input id="data_coleta" name="data_coleta" type="date" defaultValue={paraDataInput(dataNoLaudo)} />
        </div>
        <div className="campo">
          <label htmlFor="profundidade">Profundidade <span className="un">cm</span></label>
          <select id="profundidade" name="profundidade" defaultValue="0-20">
            <option>0-20</option><option>20-40</option><option>0-40</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="laboratorio">Laboratório</label>
          <input id="laboratorio" name="laboratorio" defaultValue={laboratorio ?? ''} autoComplete="off" />
        </div>
      </div>
    </Cartao>
  );
}
