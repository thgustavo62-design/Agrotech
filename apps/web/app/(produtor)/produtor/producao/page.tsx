import { EmBreve } from '@/components/em-breve';

export default function ProducaoProdutor() {
  return (
    <EmBreve
      titulo="Produção"
      descricao="Produtividade esperada x realizada por safra e por talhão."
      fase="Fase 7 do roteiro — depende de agro.safras (já existe) e agro.producao_registros (proposta em docs/DATABASE_CHANGES.md), ainda não escrita."
    />
  );
}
