'use client';

import { useRouter } from 'next/navigation';
import { Cartao } from '@/components/ui';
import { LogoIcone } from '@/components/logo';
import { BotaoSair } from '@/components/botao-sair';
import { FormSenha } from '@/app/(consultor)/app/config/form-senha';

/**
 * Primeiro acesso com a senha que o proprietário definiu: a pessoa cria a própria antes de qualquer outra coisa.
 * Ao concluir, o banco tira a marca de senha provisória (gatilho em auth.users) e a tela é recarregada.
 */
export function TrocaDeSenhaObrigatoria({ nome }: { nome: string | null }) {
  const router = useRouter();
  return (
    <main className="vista" style={{ maxWidth: 560, margin: '8vh auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <LogoIcone />
        <h1 style={{ margin: '14px 0 6px' }}>Crie a sua senha{nome ? `, ${nome.split(' ')[0]}` : ''}</h1>
        <p className="nota" style={{ margin: 0 }}>
          Quem cadastrou você escolheu uma senha provisória. Por segurança, ela só serve para este primeiro acesso: defina a sua.
        </p>
      </div>
      <Cartao olho="Primeiro acesso" titulo="Nova senha">
        <FormSenha aoConcluir={() => router.refresh()} />
      </Cartao>
      <p style={{ textAlign: 'center', marginTop: 14 }}><BotaoSair className="link-sair" rotulo="Sair" /></p>
    </main>
  );
}
