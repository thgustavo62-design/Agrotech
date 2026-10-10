'use client';

import { useState } from 'react';

/** Galeria da ficha: foto grande e miniaturas. Sem JavaScript as miniaturas abrem a foto inteira em outra aba. */
export function GaleriaAtlas({ fotos, nome, creditos }: { fotos: string[]; nome: string; creditos: string }) {
  const [atual, setAtual] = useState(0);
  const total = fotos.length;
  return (
    <figure className="ac-atlas-galeria">
      <a className="ac-atlas-principal" href={fotos[atual]} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar a foto ${atual + 1} de ${total}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto estática da própria pasta public, já reduzida */}
        <img src={fotos[atual]} alt={`${nome}: foto ${atual + 1} de ${total}`} />
        <span className="ac-atlas-contador">{atual + 1} / {total}</span>
      </a>
      {total > 1 ? (
        <div className="ac-atlas-miniaturas" role="group" aria-label="Fotos da ficha">
          {fotos.map((src, i) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              data-ativa={i === atual}
              aria-label={`Ver a foto ${i + 1}`}
              onClick={(e) => { e.preventDefault(); setAtual(i); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura estática */}
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
      <figcaption className="nota">Fotos: {creditos}. Toque na foto grande para ampliar.</figcaption>
    </figure>
  );
}
