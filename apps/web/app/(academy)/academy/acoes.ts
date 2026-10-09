'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor, produtorAtual } from '@/lib/supabase/server';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { carregarCurso } from '@/lib/academy-dados';
import { proximaAula } from '@/lib/academy-cursos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/**
 * O aluno conclui uma aula. A hora é a do servidor e o banco só deixa o produtor gravar o PRÓPRIO progresso, em conteúdo que
 * ele pode ver; ao concluir a última aula de um curso em que está matriculado, o banco conclui a matrícula e emite o certificado.
 * Dentro de um curso, segue para a próxima aula não concluída; no fim, volta à página do curso (com o certificado).
 */
async function concluirAulaImpl(fd: FormData) {
  const conteudoId = texto(fd, 'conteudo_id');
  const cursoId = texto(fd, 'curso_id');
  if (!UUID.test(conteudoId) || (cursoId && !UUID.test(cursoId))) throw new ErroDeUsuario('Aula inválida.');

  const produtor = await produtorAtual();
  if (!produtor) throw new ErroDeUsuario('Só o produtor registra o progresso das aulas.');
  const sb = await criarClienteServidor();

  const { error } = await sb.schema('agro').from('academy_progresso').upsert(
    { produtor_id: produtor.id, conteudo_id: conteudoId, concluido_em: new Date().toISOString() },
    { onConflict: 'produtor_id,conteudo_id' },
  );
  if (error) lancarDoBanco(error);

  if (cursoId) {
    const curso = await carregarCurso(sb, cursoId);
    if (curso) {
      const ids = curso.aulas.map((a) => a.conteudo_id);
      const { data } = await sb.schema('agro').from('academy_progresso').select('conteudo_id').in('conteudo_id', ids).not('concluido_em', 'is', null);
      const concluidos = new Set(((data ?? []) as Array<{ conteudo_id: string }>).map((p) => p.conteudo_id));
      const proxima = proximaAula(curso.aulas, concluidos);
      redirect(proxima ? `/academy/aula/${proxima.conteudo_id}?curso=${cursoId}` : `/academy/cursos/${cursoId}`);
    }
  }
  redirect(`/academy/aula/${conteudoId}`);
}

export const concluirAula = comAviso(concluirAulaImpl);
