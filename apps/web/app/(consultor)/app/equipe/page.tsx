import { EmBreve } from '@/components/em-breve';

export default function Equipe() {
  return (
    <EmBreve
      titulo="Equipe"
      descricao="Convidar proprietário, agrônomo, técnico e assistente para o mesmo escritório, cada um com seu acesso."
      fase="Permissões granulares por papel ficam deliberadamente fora desta leva (ver docs/PRODUCT_V2.md §2.3) — hoje todo usuário do escritório tem o mesmo acesso; multiusuário de verdade é trabalho futuro."
    />
  );
}
