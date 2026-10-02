import { carregarEquipe } from './dados';
import { SecaoUsoDoPlano } from './secoes/UsoDoPlano';
import { SecaoMembros } from './secoes/Membros';
import { SecaoConvites } from './secoes/Convites';
import { SecaoMatriz } from './secoes/Matriz';
import { SecaoAtividade } from './secoes/Atividade';

export const dynamic = 'force-dynamic';

/** Equipe e permissões: quem acessa, com que perfil, convites e a referência do que cada perfil faz. */
export default async function Equipe() {
  const ctx = await carregarEquipe();
  return (
    <>
      <SecaoUsoDoPlano ctx={ctx} />
      <SecaoMembros ctx={ctx} />
      {ctx.gerencia ? (
        <SecaoConvites ctx={ctx} />
      ) : (
        <div className="aviso">Só o proprietário convida pessoas e muda perfis. Você pode consultar quem faz parte da equipe e o que cada perfil permite.</div>
      )}
      <SecaoMatriz />
      <SecaoAtividade ctx={ctx} />
    </>
  );
}
