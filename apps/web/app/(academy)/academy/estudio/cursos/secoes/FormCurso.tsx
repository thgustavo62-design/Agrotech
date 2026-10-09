'use client';

import { useState } from 'react';
import { NIVEIS, ROTULO_NIVEL, ROTULO_TEMA, TEMAS, type Visibilidade } from '@/lib/academy';
import type { Curso } from '@/lib/academy-cursos';
import type { ProdutorOpcao } from '../../conteudos/secoes/FormConteudo';
import { excluirCurso, salvarCurso } from '../acoes';

/** Dados, capa e quem vê. A estrutura (módulos e aulas) fica ao lado, em outra seção da página. */
export function FormCurso({
  curso, produtores, selecionados, capaUrl, podeEditar,
}: {
  curso: Curso | null;
  produtores: ProdutorOpcao[];
  selecionados: string[];
  capaUrl: string | null;
  podeEditar: boolean;
}) {
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(curso?.visibilidade ?? 'todos');
  const status = curso?.status ?? 'rascunho';
  const marcados = new Set(selecionados);

  return (
    <>
      <form action={salvarCurso} encType="multipart/form-data">
        {curso ? <input type="hidden" name="id" value={curso.id} /> : null}
        <fieldset disabled={!podeEditar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="grade g2">
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="titulo">Título do curso</label>
              <input id="titulo" name="titulo" defaultValue={curso?.titulo ?? ''} maxLength={160} required autoComplete="off" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="resumo">Resumo <span className="un">aparece no cartão do curso — até 400 letras</span></label>
              <textarea id="resumo" name="resumo" rows={2} defaultValue={curso?.resumo ?? ''} maxLength={400} />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="descricao">Sobre o curso <span className="un">o que a pessoa vai aprender, para quem é</span></label>
              <textarea id="descricao" name="descricao" rows={6} defaultValue={curso?.descricao ?? ''} maxLength={5000} />
            </div>
            <div className="campo">
              <label htmlFor="cultura">Cultura <span className="un">opcional{visibilidade === 'cultura' ? ' — obrigatória para "por cultura"' : ''}</span></label>
              <input id="cultura" name="cultura" defaultValue={curso?.cultura ?? ''} maxLength={60} placeholder="café, milho, soja…" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="tema">Tema</label>
              <select id="tema" name="tema" defaultValue={curso?.tema ?? ''}>
                <option value="">— sem tema —</option>
                {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="nivel">Nível</label>
              <select id="nivel" name="nivel" defaultValue={curso?.nivel ?? 'basico'}>
                {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="capa">Capa <span className="un">JPG, PNG ou WebP — até 5 MB. Sem capa, usa a cor do tema.</span></label>
              {curso?.capa_path ? (
                <p className="nota" style={{ margin: '0 0 6px' }}>
                  {capaUrl ? <a href={capaUrl} target="_blank" rel="noopener noreferrer">Ver a capa atual</a> : 'Já tem capa'}. Enviar outra substitui.{' '}
                  <label className="conferi" style={{ display: 'inline-flex', marginTop: 0 }}>
                    <input type="checkbox" name="remover_capa" /> remover a capa
                  </label>
                </p>
              ) : null}
              <input id="capa" name="capa" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 26px', margin: '16px 0 4px' }}>
            <label className="marcar-item"><input type="checkbox" name="certificado" defaultChecked={curso?.certificado ?? true} /> Emite certificado de participação ao concluir</label>
            <label className="marcar-item"><input type="checkbox" name="destaque" defaultChecked={curso?.destaque ?? false} /> Curso em destaque na página inicial</label>
          </div>

          <div className="campo" style={{ marginTop: 14 }}>
            <label>Quem pode ver o curso</label>
            <div className="opcoes-tipo" role="radiogroup" aria-label="Quem pode ver o curso">
              <label>
                <input type="radio" name="visibilidade" value="todos" checked={visibilidade === 'todos'} onChange={() => setVisibilidade('todos')} />
                <b>Todos os meus produtores</b>Aparece no catálogo de todos.
              </label>
              <label>
                <input type="radio" name="visibilidade" value="cultura" checked={visibilidade === 'cultura'} onChange={() => setVisibilidade('cultura')} />
                <b>Quem tem a cultura</b>Só quem tem talhão da cultura acima.
              </label>
              <label>
                <input type="radio" name="visibilidade" value="selecionados" checked={visibilidade === 'selecionados'} onChange={() => setVisibilidade('selecionados')} />
                <b>Só os que eu escolher</b>Quem receber uma indicação do curso também passa a ver.
              </label>
            </div>
          </div>
          {visibilidade === 'selecionados' ? (
            <div className="campo" style={{ marginTop: 10 }}>
              <label>Produtores com acesso <span className="un">{produtores.length} cadastrado(s)</span></label>
              {produtores.length === 0 ? <p className="nota">Nenhum produtor cadastrado ainda.</p> : (
                <div className="marcar-lista">
                  {produtores.map((p) => (
                    <label className="marcar-item" key={p.id}>
                      <input type="checkbox" name="produtor_id" value={p.id} defaultChecked={marcados.has(p.id)} /> {p.nome}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </fieldset>

        {podeEditar ? (
          <div className="acoes-form">
            {status === 'rascunho' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="publicar">Publicar curso</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Salvar rascunho</button>
              </>
            ) : null}
            {status === 'publicado' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="salvar">Salvar alterações</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Voltar a rascunho</button>
                <button className="btn sec" type="submit" name="intencao" value="arquivar">Arquivar</button>
              </>
            ) : null}
            {status === 'arquivado' ? (
              <>
                <button className="btn verde" type="submit" name="intencao" value="publicar">Publicar de novo</button>
                <button className="btn sec" type="submit" name="intencao" value="rascunho">Voltar a rascunho</button>
              </>
            ) : null}
          </div>
        ) : null}
      </form>

      {podeEditar && curso ? (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--grafite)' }}>Excluir este curso</summary>
          <form action={excluirCurso} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={curso.id} />
            <p className="nota" style={{ margin: '0 0 8px' }}>
              Apaga o curso, a estrutura, as matrículas, o progresso e os <b>certificados já emitidos</b> deste curso. Os conteúdos continuam na biblioteca.
              Para só tirar do ar, use <b>Arquivar</b>.
            </p>
            <button className="btn perigo mini" type="submit">Confirmar exclusão</button>
          </form>
        </details>
      ) : null}
    </>
  );
}
