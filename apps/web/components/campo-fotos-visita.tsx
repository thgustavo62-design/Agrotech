'use client';

import { useRef, useState } from 'react';

const LADO_MAX = 1600;
const QUALIDADE = 0.8;
const MAX_FOTOS = 6;

/** Reduz a foto do celular (4–10 MB) para ~300–800 KB antes de subir: o servidor tem
 *  limite de corpo e o campo costuma ter sinal fraco. Se o navegador não conseguir
 *  decodificar, devolve null e a foto é descartada com aviso. */
async function reduzir(arquivo: File): Promise<File | null> {
  try {
    const img = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
    if (!blob) return null;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

/**
 * Fotos + localização da visita. O input visível não tem `name` (não vai no form);
 * o input oculto `fotos` recebe as imagens já reduzidas via DataTransfer. A
 * localização é a do aparelho no momento do registro e vale para todas as fotos.
 */
export function CampoFotosVisita() {
  const oculto = useRef<HTMLInputElement>(null);
  const [qtd, setQtd] = useState(0);
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidas = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    setBusy(true);
    setAviso('');
    const dt = new DataTransfer();
    let descartadas = 0;
    for (const f of escolhidas.slice(0, MAX_FOTOS)) {
      const r = await reduzir(f);
      if (r) dt.items.add(r);
      else descartadas++;
    }
    if (escolhidas.length > MAX_FOTOS) setAviso(`Máximo de ${MAX_FOTOS} fotos por visita — as demais foram ignoradas.`);
    else if (descartadas) setAviso(`${descartadas} arquivo(s) não puderam ser lidos como imagem.`);
    if (oculto.current) oculto.current.files = dt.files;
    setQtd(dt.files.length);
    setBusy(false);
  }

  function localizar() {
    if (!navigator.geolocation) {
      setGpsMsg('Este aparelho não oferece localização.');
      return;
    }
    setGpsMsg('Obtendo localização…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGpsMsg(`Precisão de cerca de ${Math.round(p.coords.accuracy)} m.`);
      },
      () => setGpsMsg('Não foi possível obter a localização (permissão negada ou sem sinal).'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <p className="nota" style={{ margin: '4px 0 8px' }}>Fotos da visita (opcional, até {MAX_FOTOS}):</p>
      <input type="file" accept="image/*" multiple onChange={escolher} aria-label="Escolher fotos da visita" />
      <input ref={oculto} type="file" name="fotos" multiple hidden />
      {busy ? <p className="nota">Preparando fotos…</p> : qtd > 0 ? <p className="nota">{qtd} foto(s) prontas para enviar.</p> : null}
      {aviso ? <p className="nota" style={{ color: 'var(--c-mb)' }}>{aviso}</p> : null}

      <input name="legenda_fotos" placeholder="legenda das fotos (opcional)" autoComplete="off" style={{ marginTop: 8, width: '100%' }} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn sec mini" onClick={localizar}>📍 Registrar minha localização</button>
        {pos ? <span className="nota">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span> : null}
        {gpsMsg ? <span className="nota">{gpsMsg}</span> : null}
      </div>
      <input type="hidden" name="lat" value={pos?.lat ?? ''} />
      <input type="hidden" name="lng" value={pos?.lng ?? ''} />
    </div>
  );
}
