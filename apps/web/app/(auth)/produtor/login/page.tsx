import { redirect } from 'next/navigation';
import { loginDoSite } from '@/lib/sites';

/** A entrada do produtor agora é a tela única de login (com a escolha do site). Links e favoritos antigos continuam valendo. */
export default function LoginProdutorAntigo() {
  redirect(loginDoSite('assistencia', 'produtor'));
}
