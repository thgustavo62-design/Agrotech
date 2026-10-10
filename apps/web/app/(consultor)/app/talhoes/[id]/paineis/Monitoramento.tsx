import Link from 'next/link';
import { dataBR } from '@/lib/formato';
import { perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { linkIndicarFicha } from '@/lib/atlas-indicacoes';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { registrarVisita } from '../acoes';
import { CampoFotosVisita } from '@/components/campo-fotos-visita';
import { FormFilaOffline } from '@/components/form-fila-offline';
import type { ContextoTalhao } from '../dados';

export async function PainelMonitoramento({ ctx }: { ctx: ContextoTalhao }) {
  const { id, visitas, produtor } = ctx;
  const perfil = await perfilAtual();
  const podeIndicar = pode(perfil?.perfis, 'academy.indicar');

  return (
    (
      <>
        {visitas.length === 0 ? (
          <Vazio titulo="Nenhuma visita registrada para este talhão" />
        ) : (
          <div className="lista">
            {visitas.map((v) => {
              const acima = (v.ocorrencias ?? []).filter((o) => o.acima_nivel).length;
              return (
                <div className="item" key={v.id}>
                  <div className="cresce">
                    <h3>{dataBR(v.data)} — {v.fenologia ?? 'estádio não informado'}</h3>
                    <small>condição {v.condicao ?? '—'}{v.observacoes ? ` · ${v.observacoes}` : ''}</small>
                  </div>
                  {acima > 0 ? <Tag tom="ruim">{acima} acima do nível</Tag> : <Tag>sob controle</Tag>}
                  {podeIndicar && linkIndicarFicha({ produtorId: produtor?.id, visitaId: v.id }) ? (
                    <Link className="btn sec mini" href={linkIndicarFicha({ produtorId: produtor?.id, visitaId: v.id })!}>Indicar ficha</Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <Cartao olho="Novo" titulo="Registrar visita" style={{ marginTop: 14 }}>
          <FormFilaOffline action={registrarVisita} className="grade g2" rotuloOk="Visita salva.">
            <input type="hidden" name="talhao_id" value={id} />
            <div className="campo"><label htmlFor="v_data">Data</label><input id="v_data" name="data" type="date" required /></div>
            <div className="campo"><label htmlFor="v_fenologia">Estádio fenológico</label><input id="v_fenologia" name="fenologia" autoComplete="off" /></div>
            <div className="campo">
              <label htmlFor="v_condicao">Condição geral</label>
              <select id="v_condicao" name="condicao" defaultValue="">
                <option value="">—</option>
                <option value="Boa">Boa</option>
                <option value="Regular">Regular</option>
                <option value="Preocupante">Preocupante</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="v_proxima">Próxima visita (opcional)</label><input id="v_proxima" name="proxima_visita" type="date" /></div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="v_obs">Observações</label>
              <input id="v_obs" name="observacoes" autoComplete="off" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="v_rec">Recomendação de campo (opcional)</label>
              <input id="v_rec" name="recomendacao" autoComplete="off" />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <p className="nota" style={{ margin: '4px 0 8px' }}>Ocorrências observadas (opcional, até 3):</p>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input name={`oc${i}_alvo`} placeholder="alvo — ex.: lagarta, ferrugem" style={{ flex: 2, minWidth: 160 }} autoComplete="off" />
                  <input name={`oc${i}_valor`} placeholder="valor — ex.: 3 por planta" style={{ flex: 1, minWidth: 120 }} autoComplete="off" />
                  <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="checkbox" name={`oc${i}_acima`} /> acima do nível
                  </label>
                </div>
              ))}
            </div>

            <CampoFotosVisita />

            <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Salvar visita</button></div>
          </FormFilaOffline>
        </Cartao>
      </>
    )
  );
}
