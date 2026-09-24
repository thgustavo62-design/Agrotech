import Link from 'next/link';
import { CabecalhoVista, Cartao } from '@/components/ui';

/** Tela mostrada no lugar de uma funcionalidade que o plano do escritório não inclui. */
export function PrecisaUpgrade({
  titulo, descricao, href,
}: {
  titulo: string;
  descricao: string;
  /** Só passe se quem vê a tela puder de fato mudar de plano (consultor/admin). */
  href?: string;
}) {
  return (
    <>
      <CabecalhoVista olho="Recurso do plano" titulo={titulo} descricao={descricao} />
      <Cartao olho="Plano" titulo="Seu escritório ainda não tem esse recurso">
        <p className="nota" style={{ margin: href ? '0 0 12px' : 0 }}>
          {href ? 'Confira os planos disponíveis abaixo.' : 'Fale com o seu técnico — só ele consegue mudar o plano do escritório.'}
        </p>
        {href ? <Link className="btn verde" href={href}>Ver planos</Link> : null}
      </Cartao>
    </>
  );
}
