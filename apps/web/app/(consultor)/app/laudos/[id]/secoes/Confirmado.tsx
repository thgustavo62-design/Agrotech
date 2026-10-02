import Link from 'next/link';
import { CabecalhoVista, Vazio } from '@/components/ui';
import type { DadosConferencia } from '../dados';

/** Laudo cujas amostras já viraram análise: só leva até elas. */
export function Confirmado({ doc, geradas }: Extract<DadosConferencia, { tipo: 'confirmado' }>) {
  return (
    <>
      <CabecalhoVista olho="Laudo" titulo={doc.nome_arquivo} descricao="Já conferido e confirmado." />
      <Vazio titulo={geradas.length > 1 ? 'Este laudo virou análises' : 'Este laudo virou análise'}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {geradas.map((a) => (
            <Link key={a.id} className="btn verde mini" href={`/app/analises/${a.id}`}>
              {a.amostra_indice ? `Amostra ${a.amostra_indice}` : 'Abrir a análise'}
            </Link>
          ))}
        </div>
      </Vazio>
    </>
  );
}
