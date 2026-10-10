import Link from 'next/link';
import { fotosDaFicha, type FichaAtlas } from '@/lib/atlas-base';

const nivel = (n: string): 'alta' | 'media' | 'baixa' => (/extrema|elevada|alta/i.test(n) ? 'alta' : /m[eé]dia|moderada/i.test(n) ? 'media' : 'baixa');

/** Cartão de ficha (foto, tipo, nome, nome científico e importância): usado nas fileiras e na grade do Atlas. */
export function CartaoFicha({ ficha }: { ficha: FichaAtlas }) {
  const foto = fotosDaFicha(ficha)[0];
  return (
    <Link className="ac-atlas-cartao" href={`/academy/atlas/${ficha.slug}`}>
      <span className="ac-atlas-foto">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto estática ou assinada, já reduzida
          <img src={foto} alt={`${ficha.nome}: foto de referência`} loading="lazy" width={320} height={220} />
        ) : (
          <span className="ac-atlas-sem-foto" aria-hidden="true">{ficha.nome.slice(0, 1)}</span>
        )}
        <span className="ac-atlas-selo" data-tipo={ficha.tipo}>{ficha.tipo === 'doenca' ? 'Doença' : 'Praga'}</span>
        {ficha.origem === 'escritorio' ? <span className="ac-atlas-selo ac-atlas-selo-escritorio ac-atlas-selo-canto">Do escritório</span> : null}
      </span>
      <span className="ac-atlas-corpo">
        <b>{ficha.nome}</b>
        {ficha.cientifico ? <i>{ficha.cientifico}</i> : null}
        <span className="ac-atlas-nivel" data-nivel={nivel(ficha.importancia.campo)}>Importância no campo: {ficha.importancia.campo.toLowerCase()}</span>
      </span>
    </Link>
  );
}
