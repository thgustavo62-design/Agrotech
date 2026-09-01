'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { criarAnalise } from '@/app/(consultor)/app/analises/nova/acoes';

type Talhao = { id: string; nome: string; produtor: string };

const CampoNum = ({ id, rot, un }: { id: string; rot: string; un?: string }) => (
  <div className="campo">
    <label htmlFor={id}>
      {rot} {un ? <span className="un">{un}</span> : null}
    </label>
    <input className="mono" id={id} name={id} inputMode="decimal" autoComplete="off" />
  </div>
);

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn verde" disabled={pending}>
      {pending ? 'Interpretando…' : 'Interpretar'}
    </button>
  );
}

export function FormAnalise({ talhoes }: { talhoes: Talhao[] }) {
  return (
    <form action={criarAnalise}>
      <div className="cartao">
        <div className="grade g2">
          <div className="campo">
            <label htmlFor="talhao_id">Talhão</label>
            <select id="talhao_id" name="talhao_id" required defaultValue="">
              <option value="" disabled>selecione…</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.id}>{t.nome} — {t.produtor}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="data_coleta">Data da coleta</label>
            <input type="date" id="data_coleta" name="data_coleta" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="campo">
            <label htmlFor="profundidade">Profundidade <span className="un">cm</span></label>
            <select id="profundidade" name="profundidade" defaultValue="0-20">
              <option>0-20</option>
              <option>20-40</option>
              <option>0-40</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="laboratorio">Laboratório</label>
            <input id="laboratorio" name="laboratorio" autoComplete="off" />
          </div>
        </div>

        <h3 style={{ margin: '18px 0 8px' }}>Complexo sortivo</h3>
        <div className="grade g4">
          <CampoNum id="argila" rot="Argila" un="%" />
          <CampoNum id="ph" rot="pH" un="H₂O" />
          <CampoNum id="mo" rot="M.O." un="dag/kg" />
          <CampoNum id="p" rot="P" un="mg/dm³" />
          <CampoNum id="k" rot="K" un="mg/dm³" />
          <CampoNum id="ca" rot="Ca" un="cmolc/dm³" />
          <CampoNum id="mg" rot="Mg" un="cmolc/dm³" />
          <CampoNum id="al" rot="Al" un="cmolc/dm³" />
          <CampoNum id="h_al" rot="H+Al" un="cmolc/dm³" />
          <CampoNum id="na" rot="Na" un="mg/dm³" />
          <CampoNum id="s" rot="S" un="mg/dm³" />
        </div>

        <h3 style={{ margin: '18px 0 8px' }}>Micronutrientes</h3>
        <div className="grade g4">
          <CampoNum id="b" rot="B" un="mg/dm³" />
          <CampoNum id="zn" rot="Zn" un="mg/dm³" />
          <CampoNum id="cu" rot="Cu" un="mg/dm³" />
          <CampoNum id="mn" rot="Mn" un="mg/dm³" />
          <CampoNum id="fe" rot="Fe" un="mg/dm³" />
        </div>

        <h3 style={{ margin: '18px 0 8px' }}>Parâmetros do corretivo</h3>
        <div className="grade g3">
          <CampoNum id="prnt" rot="PRNT do calcário" un="% (padrão 85)" />
          <CampoNum id="incorporacao" rot="Incorporação" un="cm (padrão 20)" />
          <CampoNum id="prod_esperada" rot="Produtividade esperada" un="sobrescreve o talhão" />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Enviar />
          <Link className="btn sec" href="/app/analises">Cancelar</Link>
        </div>
      </div>
    </form>
  );
}
