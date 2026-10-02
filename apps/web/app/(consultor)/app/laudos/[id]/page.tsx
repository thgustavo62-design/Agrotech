import { carregarConferencia } from './dados';
import { Confirmado } from './secoes/Confirmado';
import { Lendo } from './secoes/Lendo';
import { Conferencia } from './secoes/Conferencia';

export const dynamic = 'force-dynamic';

/** Conferência de um laudo enviado: o que se vê depende do estado do documento (lendo, em revisão, confirmado). */
export default async function ConferenciaLaudo({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amostra?: string }>;
}) {
  const { id } = await params;
  const { amostra } = await searchParams;
  const dados = await carregarConferencia(id, amostra);

  switch (dados.tipo) {
    case 'confirmado': return <Confirmado {...dados} />;
    case 'extraindo': return <Lendo id={id} doc={dados.doc} />;
    default: return <Conferencia {...dados} />;
  }
}
