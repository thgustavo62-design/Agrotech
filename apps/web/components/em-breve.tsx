import { CabecalhoVista, Cartao } from './ui';

/** Placeholder consistente para telas planejadas em PRODUCT_V2.md e ainda não construídas. */
export function EmBreve({
  titulo, descricao, fase, doc = 'docs/PRODUCT_V2.md',
}: {
  titulo: string;
  descricao: string;
  fase: string;
  doc?: string;
}) {
  return (
    <>
      <CabecalhoVista olho="Em breve" titulo={titulo} descricao={descricao} />
      <Cartao olho="Planejado" titulo={fase}>
        <p className="nota">
          O desenho desta tela está em <code>{doc}</code>, mas ela ainda não foi construída —
          veja o roteiro por fases nesse documento.
        </p>
      </Cartao>
    </>
  );
}
