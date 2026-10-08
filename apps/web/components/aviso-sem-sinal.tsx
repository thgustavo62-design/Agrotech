'use client';

import { useEffect, useState } from 'react';

/**
 * Faixa discreta quando o aparelho perde o sinal: deixa claro que o que está na tela é uma cópia (e de que horas),
 * e que visitas continuam sendo guardadas e enviadas depois. `geradoEm` é o instante em que o servidor montou a página
 * — se ela veio do cache do aparelho, é a hora da última vez que o técnico a viu com sinal.
 */
export function AvisoSemSinal({ geradoEm }: { geradoEm: string }) {
  const [semSinal, setSemSinal] = useState(false);

  useEffect(() => {
    const atualizar = () => setSemSinal(!navigator.onLine);
    atualizar();
    window.addEventListener('online', atualizar);
    window.addEventListener('offline', atualizar);
    return () => {
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
    };
  }, []);

  if (!semSinal) return null;
  const hora = new Date(geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = new Date(geradoEm).toLocaleDateString('pt-BR');
  return (
    <div className="aviso-sem-sinal nao-imprime" role="status">
      <b>Sem sinal.</b> Você está vendo dados salvos no aparelho (de {dia} às {hora}). Visitas registradas agora ficam guardadas e são enviadas quando o sinal voltar.
    </div>
  );
}
