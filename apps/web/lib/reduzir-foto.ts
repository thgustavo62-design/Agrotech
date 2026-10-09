const LADO_MAX = 1600;
const QUALIDADE = 0.8;

/**
 * Reduz a foto do celular (4–10 MB) para ~300–800 KB antes de subir: o servidor tem limite de corpo e o campo costuma ter
 * sinal fraco. Se o navegador não conseguir decodificar, devolve null e a foto é descartada com aviso. Só roda no navegador.
 */
export async function reduzirFoto(arquivo: File): Promise<File | null> {
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
