import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirConta } from '@/lib/guarda-de-site';
import { formatarCarga } from '@/lib/academy-cursos';
import { dataBR } from '@/lib/formato';
import { BotaoImprimir } from '@/components/botao-imprimir';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Certificado {
  id: string;
  codigo: string;
  emitido_em: string;
  titulo_curso: string;
  aluno_nome: string;
  escritorio_nome: string;
  responsavel_nome: string | null;
  responsavel_crea: string | null;
  carga_min: number;
  aulas: number;
}

/**
 * Certificado de PARTICIPAÇÃO. Tudo vem da foto gravada pelo banco no momento em que o aluno concluiu todas as aulas
 * (curso, aluno, escritório, responsável, carga). Não é certificação acadêmica nem profissional — e o texto diz isso.
 */
export default async function PaginaDoCertificado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { sb } = await exigirConta('academy');
  const { data } = await sb.schema('agro').from('academy_certificados')
    .select('id, codigo, emitido_em, titulo_curso, aluno_nome, escritorio_nome, responsavel_nome, responsavel_crea, carga_min, aulas')
    .eq('id', id).maybeSingle();
  if (!data) notFound();
  const c = data as unknown as Certificado;

  return (
    <main className="ac-principal">
      <div className="nao-imprime" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <BotaoImprimir />
        <Link className="btn sec" href="/academy/meus-cursos?aba=concluidos">Voltar</Link>
      </div>

      <section className="ac-certificado" aria-label={`Certificado de participação de ${c.aluno_nome}`}>
        <div className="ac-cert-marca">AgroTech Academy · {c.escritorio_nome}</div>
        <h1>Certificado de participação</h1>
        <p>Certificamos que</p>
        <div className="ac-cert-nome">{c.aluno_nome}</div>
        <p>concluiu todas as <b>{c.aulas}</b> {c.aulas === 1 ? 'aula' : 'aulas'} do curso</p>
        <div className="ac-cert-curso">{c.titulo_curso}</div>
        <p>
          {c.carga_min > 0 ? <>com carga horária prevista de <b>{formatarCarga(c.carga_min)}</b>, </> : null}
          concluído em <b>{dataBR(c.emitido_em)}</b>.
        </p>

        <div className="ac-cert-rodape">
          <div className="ac-cert-assinatura">
            <i />
            <b>{c.responsavel_nome ?? c.escritorio_nome}</b>
            <div>{c.responsavel_crea ? `Responsável técnico · CREA ${c.responsavel_crea}` : 'Responsável pelo curso'}</div>
            <div>{c.escritorio_nome}</div>
          </div>
          <div>
            <div>Código do certificado</div>
            <b style={{ fontFamily: 'var(--fonte-mono, monospace)', fontSize: 16 }}>{c.codigo}</b>
            <div>Emitido em {dataBR(c.emitido_em)}</div>
          </div>
        </div>

        <p className="ac-cert-aviso">
          Certificado de participação emitido pelo escritório indicado, com base nas aulas concluídas na AgroTech Academy.
          A carga horária é a prevista nas aulas, não tempo medido. Não equivale a certificação acadêmica nem a habilitação profissional.
          Para conferir a autenticidade, informe o código ao escritório.
        </p>
      </section>
    </main>
  );
}
