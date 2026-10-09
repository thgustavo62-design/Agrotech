'use client';

import { useState } from 'react';

/**
 * Vídeo do YouTube/Vimeo embutido SÓ depois do clique: até lá a página não fala com o provedor (privacidade e dados móveis).
 * O endereço do player vem de `embedDeVideo` (lib/academy.ts) e é o único que a CSP aceita em iframe.
 */
export function VideoComFachada({ embed, provedor, titulo, linkOriginal }: {
  embed: string;
  provedor: 'youtube' | 'vimeo';
  titulo: string;
  linkOriginal: string;
}) {
  const [aberto, setAberto] = useState(false);
  const nome = provedor === 'youtube' ? 'YouTube' : 'Vimeo';
  return (
    <div className="ac-video">
      {aberto ? (
        <iframe
          src={`${embed}${embed.includes('?') ? '&' : '?'}autoplay=1`}
          title={titulo}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      ) : (
        <button type="button" className="ac-video-fachada" onClick={() => setAberto(true)}>
          <span className="ac-video-play" aria-hidden="true">▶</span>
          <b>Assistir aqui</b>
          <small>O vídeo do {nome} só carrega quando você clica.</small>
        </button>
      )}
      <a className="ac-video-fora" href={linkOriginal} target="_blank" rel="noopener noreferrer">Abrir no {nome} (outra aba)</a>
    </div>
  );
}
