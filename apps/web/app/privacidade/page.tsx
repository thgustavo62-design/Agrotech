import { LogoIcone } from '@/components/logo';

export const metadata = { title: 'Política de privacidade — AgroTech' };

export default function Privacidade() {
  return (
    <main style={{ padding: '40px 20px 60px' }}>
      <div className="folha-a4">
        <div className="marca" style={{ marginBottom: 24 }}>
          <LogoIcone />AgroTech <span>Assistência técnica</span>
        </div>
        <h1 style={{ marginBottom: 6 }}>Política de privacidade</h1>
        <p className="nota" style={{ marginBottom: 24 }}>Última atualização: setembro de 2026.</p>

        <p>
          Esta política explica quais dados o AgroTech trata, para quê, e quais direitos você
          tem sobre eles, em linha com a Lei Geral de Proteção de Dados (LGPD).
        </p>

        <h2 style={{ marginTop: 24 }}>Dados que tratamos</h2>
        <p>
          Dados de cadastro (nome, e-mail, CREA/ART), dados de propriedades e talhões, resultados
          de análises de solo e recomendações, registros financeiros (quando cadastrados pelo
          próprio produtor, isolados do consultor), fotos de visitas e documentos enviados
          (laudos em PDF), e um registro de auditoria das ações realizadas na conta.
        </p>

        <h2 style={{ marginTop: 24 }}>Para que usamos</h2>
        <p>
          Exclusivamente para operar a plataforma: calcular recomendações agronômicas, gerar
          laudos, organizar a agenda de visitas e permitir que o produtor acompanhe sua lavoura.
          Não vendemos dados a terceiros nem os usamos para publicidade.
        </p>

        <h2 style={{ marginTop: 24 }}>Isolamento entre contas</h2>
        <p>
          Cada escritório só acessa os dados dos seus próprios produtores. Os dados financeiros
          de um produtor não são visíveis ao consultor — essa separação é aplicada no banco de
          dados, não apenas na tela.
        </p>

        <h2 style={{ marginTop: 24 }}>Seus direitos</h2>
        <p>
          Você pode solicitar ao seu consultor a exportação dos seus dados (formato JSON) ou a
          exclusão completa da sua conta e dos dados associados — o consultor tem, dentro do
          app, as ferramentas para atender esses dois pedidos.
        </p>

        <h2 style={{ marginTop: 24 }}>Contato</h2>
        <p>
          Dúvidas sobre seus dados podem ser encaminhadas diretamente ao seu técnico responsável
          ou ao suporte da plataforma.
        </p>

        <p className="nota" style={{ marginTop: 30 }}>
          Este é um texto padrão inicial da plataforma — para operação comercial formal,
          recomendamos revisão por um advogado antes da publicação definitiva.
        </p>
      </div>
    </main>
  );
}
