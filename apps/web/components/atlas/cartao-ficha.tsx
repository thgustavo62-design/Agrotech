import Link from 'next/link';
import { fotosDaFicha, type FichaAtlas } from '@/lib/atlas-base';

const nivel = (n: string): 'alta' | 'media' | 'baixa' => (/extrema|elevada|alta/i.test(n) ? 'alta' : /m[eé]dia|moderada/i.test(n) ? 'media' : 'baixa');

/** Cartão de ficha (foto, tipo, nome, nome científico e importância): usado nas fileiras e na grade do Atlas. */
export function CartaoFicha({ ficha }: { ficha: FichaAtlas }) {
  return (
    <Link className="ac-atlas-cartao" href={`/academy/atlas/${ficha.slug}`}>
      <span className="ac-atlas-foto">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto estática da própria pasta public, já reduzida */}
        <img src={fotosDaFicha(ficha)[0]} alt={`${ficha.nome}: foto de referência`} loading="lazy" width={320} height={220} />
        <span className="ac-atlas-selo" data-tipo={ficha.tipo}>{ficha.tipo === 'doenca' ? 'Doença' : 'Praga'}</span>
      </span>
      <span className="ac-atlas-corpo">
        <b>{ficha.nome}</b>
        <i>{ficha.cientifico}</i>
        <span className="ac-atlas-nivel" data-nivel={nivel(ficha.importancia.campo)}>Importância no campo: {ficha.importancia.campo.toLowerCase()}</span>
      </span>
    </Link>
  );
}
