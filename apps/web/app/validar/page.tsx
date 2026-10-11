import type { Metadata } from 'next';
import Link from 'next/link';
import { clientePublico } from '@/lib/supabase/publico';
import { formatarCarga, codigoDeCertificadoValido } from '@/lib/academy-cursos';
import { normalizarCodigo } from '@/lib/certificado';
import { dataBR } from '@/lib/formato';
import { LogoIcone } from '@/components/logo';
import './validar.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Conferir certificado — AgroTech Academy',
  description: 'Confira se um certificado de participação da AgroTech Academy é verdadeiro.',
  robots: { index: false, follow: false },
};

interface Conferido {
  aluno_nome: string;
  titulo_curso: string;
  escritorio_nome: string;
  emitido_em: string;
  carga_min: number;
  aulas: number;
  responsavel_nome: string | null;
}

/** Página pública (sem login): quem recebe um certificado confere pelo código. Só mostra o que está impresso nele. */
export default async function ConferirCertificado({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo: bruto } = await searchParams;
  const codigo = normalizarCodigo(bruto ?? '');
  const informou = Boolean((bruto ?? '').trim());
  const formatoOk = codigoDeCertificadoValido(codigo);

  let achado: Conferido | null = null;
  let indisponivel = false;
  if (formatoOk) {
    const sb = clientePublico();
    if (!sb) indisponivel = true;
    else {
      const { data, error } = await sb.schema('agro').rpc('certificado_publico', { p_codigo: codigo });
      if (error) indisponivel = true;
      else achado = ((data as Conferido[] | null) ?? [])[0] ?? null;
    }
  }

  return (
    <main className="validar">
      <header className="validar-topo">
        <LogoIcone tamanho={34} />
        <div><b>AgroTech</b> Academy<small>Conferência de certificado</small></div>
      </header>

      <section className="validar-cartao">
        <h1>Conferir um certificado</h1>
        <p>Digite o código que está impresso no certificado (começa com <b>AT-</b>).</p>
        <form method="get" className="validar-form" role="search">
          <input name="codigo" defaultValue={bruto ?? ''} placeholder="AT-1A2B3-C4D5E" aria-label="Código do certificado" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} required />
          <button type="submit" className="btn verde">Conferir</button>
        </form>

        {informou && !formatoOk ? (
          <div className="validar-resultado validar-erro" role="alert">
            <b>Código em formato inválido</b>
            <p>O código tem o formato <b>AT-XXXXX-XXXXX</b> (letras de A a F e números). Confira se digitou tudo certo.</p>
          </div>
        ) : null}

        {indisponivel ? (
          <div className="validar-resultado validar-erro" role="alert">
            <b>Não foi possível conferir agora</b>
            <p>Tente de novo em alguns instantes.</p>
          </div>
        ) : null}

        {formatoOk && !indisponivel && !achado ? (
          <div className="validar-resultado validar-erro" role="alert">
            <b>Certificado não encontrado</b>
            <p>Não existe certificado com o código <b className="validar-codigo">{codigo}</b>. Confira o código ou fale com o escritório que o emitiu. <b>Não aceite o certificado como verdadeiro até conferir.</b></p>
          </div>
        ) : null}

        {achado ? (
          <div className="validar-resultado validar-ok" role="status">
            <b>✓ Certificado verdadeiro</b>
            <dl>
              <div><dt>Participante</dt><dd>{achado.aluno_nome}</dd></div>
              <div><dt>Curso concluído</dt><dd>{achado.titulo_curso}</dd></div>
              <div><dt>Concluído em</dt><dd>{dataBR(achado.emitido_em)}</dd></div>
              <div><dt>Aulas</dt><dd>{achado.aulas}{achado.carga_min > 0 ? ` · carga prevista de ${formatarCarga(achado.carga_min)}` : ''}</dd></div>
              <div><dt>Emitido por</dt><dd>{achado.escritorio_nome}{achado.responsavel_nome ? ` · ${achado.responsavel_nome}` : ''}</dd></div>
              <div><dt>Código</dt><dd className="validar-codigo">{codigo}</dd></div>
            </dl>
            <p className="validar-aviso">Certificado de <b>participação</b>, emitido pelo escritório indicado com base nas aulas concluídas na AgroTech Academy. Não equivale a certificação acadêmica nem a habilitação profissional.</p>
          </div>
        ) : null}
      </section>

      <p className="validar-rodape"><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link></p>
    </main>
  );
}
