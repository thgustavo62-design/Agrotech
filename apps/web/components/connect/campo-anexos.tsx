'use client';

import { useRef, useState } from 'react';
import { reduzirFoto } from '@/lib/reduzir-foto';
import { MAX_FOTOS_POR_ENVIO } from '@/lib/connect';

const MAX_PDF = 6 * 1024 * 1024;

/**
 * Anexos do pedido/mensagem. O seletor visível não tem `name` (não vai no form); o campo oculto `arquivos` recebe as fotos
 * já reduzidas via DataTransfer (o servidor tem limite de corpo). PDF só quando `permitirPdf` (equipe) e até 6 MB.
 */
export function CampoAnexos({ rotulo = 'Fotos', permitirPdf = false }: { rotulo?: string; permitirPdf?: boolean }) {
  const oculto = useRef<HTMLInputElement>(null);
  const [nomes, setNomes] = useState<string[]>([]);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(e.target.files ?? []);
    setOcupado(true);
    setAviso('');
    const dt = new DataTransfer();
    let descartados = 0;
    for (const f of escolhidos.slice(0, MAX_FOTOS_POR_ENVIO)) {
      if (f.type.startsWith('image/')) {
        const r = await reduzirFoto(f);
        if (r) dt.items.add(r); else descartados++;
      } else if (permitirPdf && f.type === 'application/pdf' && f.size <= MAX_PDF) {
        dt.items.add(f);
      } else {
        descartados++;
      }
    }
    if (escolhidos.length > MAX_FOTOS_POR_ENVIO) setAviso(`Máximo de ${MAX_FOTOS_POR_ENVIO} arquivos por envio — os demais foram ignorados.`);
    else if (descartados) setAviso(`${descartados} arquivo(s) não puderam ser usados${permitirPdf ? ' (fotos, ou PDF de até 6 MB)' : ' (só fotos)'}.`);
    if (oculto.current) oculto.current.files = dt.files;
    setNomes(Array.from(dt.files).map((f) => f.name));
    setOcupado(false);
  }

  return (
    <div className="cn-anexos-campo">
      <label className="cn-rotulo">
        {rotulo} <span className="cn-opcional">(opcional, até {MAX_FOTOS_POR_ENVIO})</span>
        <input type="file" accept={permitirPdf ? 'image/*,application/pdf' : 'image/*'} multiple onChange={escolher} aria-label={rotulo} />
      </label>
      <input ref={oculto} type="file" name="arquivos" multiple hidden />
      {ocupado ? <p className="nota">Preparando…</p> : nomes.length > 0 ? <p className="nota">{nomes.length} arquivo(s) prontos para enviar.</p> : null}
      {aviso ? <p className="nota cn-aviso-texto">{aviso}</p> : null}
    </div>
  );
}
