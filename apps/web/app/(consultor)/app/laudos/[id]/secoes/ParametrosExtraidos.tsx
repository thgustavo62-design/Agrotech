import { Cartao, Tag } from '@/components/ui';
import { CAMPOS, EXTRAS_IMPRESSOS, campoExigeConferencia, tomConfianca, type Extracao, type AmostraExtraida } from '@/lib/laudo-conferencia';

/** Um campo por parâmetro, com a confiança da leitura; o técnico corrige o que estiver errado. */
export function ParametrosExtraidos({ campos, extras }: { campos: Extracao['campos']; extras: AmostraExtraida['extras'] }) {
  return (
    <Cartao olho="Parâmetros extraídos" titulo="Confira campo a campo">
      <div className="grade g4">
        {CAMPOS.map(([chave, rot, un]) => {
          const c = campos[chave];
          const { tom, txt } = tomConfianca(c?.confianca);
          const duvidoso = campoExigeConferencia(c);
          return (
            <div className={duvidoso ? 'campo duvidoso' : 'campo'} key={chave}>
              <label htmlFor={chave}>{rot} <span className="un">{un}</span></label>
              <input className="mono" id={chave} name={chave} inputMode="decimal" autoComplete="off"
                defaultValue={c?.valor ?? ''} />
              <div style={{ marginTop: 5 }}><Tag tom={tom}>{txt}</Tag></div>
              {duvidoso ? (
                <label className="conferi" title={c?.origem}>
                  <input type="checkbox" name={`conferido_${chave}`} required /> conferi com o laudo
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      {Object.keys(extras).length > 0 && (
        <p className="nota" style={{ marginTop: 10 }}>
          Impresso no laudo (o motor recalcula; serve para conferir):{' '}
          {EXTRAS_IMPRESSOS
            .filter(([k]) => extras[k]?.valor != null)
            .map(([k, r]) => `${r} ${String(extras[k]!.valor).replace('.', ',')}`)
            .join(' · ')}
          . O motor usa pH em água.
        </p>
      )}
      <div className="campo" style={{ marginTop: 12, maxWidth: 220 }}>
        <label htmlFor="prnt">PRNT do calcário <span className="un">% (padrão 85)</span></label>
        <input className="mono" id="prnt" name="prnt" inputMode="decimal" autoComplete="off" />
      </div>
    </Cartao>
  );
}
