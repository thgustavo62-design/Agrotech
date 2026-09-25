import Link from 'next/link';
import { LogoIcone } from '@/components/logo';

export const metadata = { title: 'Termos de uso — AgroTech' };

export default function Termos() {
  return (
    <main style={{ padding: '40px 20px 60px' }}>
      <div className="folha-a4">
        <div className="marca" style={{ marginBottom: 24 }}>
          <LogoIcone />AgroTech <span>Assistência técnica</span>
        </div>
        <h1 style={{ marginBottom: 6 }}>Termos de uso</h1>
        <p className="nota" style={{ marginBottom: 24 }}>Última atualização: setembro de 2026.</p>

        <p>
          O AgroTech é uma plataforma de assistência técnica agronômica operada pela Campo Forte
          (&quot;nós&quot;), usada por engenheiros agrônomos e técnicos (&quot;consultores&quot;) para gerenciar
          análises de solo, recomendações, visitas e a carteira de produtores, e pelos próprios
          produtores rurais para acompanhar sua lavoura.
        </p>

        <h2 style={{ marginTop: 24 }}>1. Conta e acesso</h2>
        <p>
          Contas de consultor são criadas por cadastro direto. Contas de produtor são criadas
          exclusivamente por convite do seu consultor — o AgroTech não permite que um produtor
          se cadastre sozinho. Cada pessoa é responsável por manter sua senha em sigilo.
        </p>

        <h2 style={{ marginTop: 24 }}>2. Uso da plataforma</h2>
        <p>
          As recomendações técnicas (calagem, gessagem, adubação) são calculadas a partir de
          parâmetros agronômicos e das tabelas de referência cadastradas por cada escritório —
          são apoio à decisão, não substituem o julgamento profissional do responsável técnico.
        </p>

        <h2 style={{ marginTop: 24 }}>3. Dados e privacidade</h2>
        <p>
          Como tratamos os dados cadastrados na plataforma está descrito na nossa{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>

        <h2 style={{ marginTop: 24 }}>4. Cobrança</h2>
        <p>
          Planos pagos são cobrados conforme descrito em <Link href="/app/assinatura">Assinatura</Link>{' '}
          dentro do próprio app. O período de teste não exige cartão de crédito.
        </p>

        <h2 style={{ marginTop: 24 }}>5. Cancelamento</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento. Dados de produtores podem ser
          exportados ou excluídos mediante solicitação, conforme a política de privacidade.
        </p>

        <p className="nota" style={{ marginTop: 30 }}>
          Este é um texto padrão inicial da plataforma — para operação comercial formal,
          recomendamos revisão por um advogado antes da publicação definitiva.
        </p>
      </div>
    </main>
  );
}
