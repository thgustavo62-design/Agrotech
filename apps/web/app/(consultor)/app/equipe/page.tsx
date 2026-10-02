import { redirect } from 'next/navigation';

/** A equipe agora mora dentro das Configurações (com perfis de acesso). Link antigo continua funcionando. */
export default function EquipeAntiga() {
  redirect('/app/config/equipe');
}
