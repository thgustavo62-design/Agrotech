import { EmBreve } from '@/components/em-breve';

export default function Agenda() {
  return (
    <EmBreve
      titulo="Agenda"
      descricao="Visitas, coletas de solo, retornos e aplicações — dia, semana e mês, com roteiro do dia."
      fase="Fase 9 do roteiro — depende da tabela agro.agenda_eventos (proposta em docs/DATABASE_CHANGES.md) e do formulário de visita, que ainda não existe no app (ver docs/PRODUCT_AUDIT.md)."
    />
  );
}
