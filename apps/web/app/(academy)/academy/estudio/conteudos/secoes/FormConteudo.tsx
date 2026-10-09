'use client';

import { useState } from 'react';
import {
  AJUDA_TIPO, NIVEIS, ROTULO_NIVEL, ROTULO_TEMA, ROTULO_TIPO, TEMAS, TIPOS,
  type Conteudo, type TipoConteudo, type Visibilidade,
} from '@/lib/academy';
import { salvarConteudo, excluirConteudo } from '../acoes';

export interface ProdutorOpcao { id: string; nome: string }

/**
 * Formulário do conteúdo. Os campos mudam conforme o tipo (vídeo pede link, artigo pede texto, material pede arquivo,
 * notícia pede resumo + fonte + link) e a lista de produtores só aparece quando o conteúdo é para "selecionados".
 * Cliente só para isso; a regra de verdade (validação, permissão, https, quem revisa) roda no servidor e no banco.
 */
export function FormConteudo({
  conteudo, produtores, selecionados, arquivoUrl, podeEditar,
}: {
  conteudo: Conteudo | null;
  produtores: ProdutorOpcao[];
  selecionados: string[];
  arquivoUrl: string | null;
  podeEditar: boolean;
}) {
  const [tipo, setTipo] = useState<TipoConteudo>(conteudo?.tipo ?? 'video');
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(conteudo?.visibilidade ?? 'todos');
  const status = conteudo?.status ?? 'rascunho';
  const lido = !podeEditar;
  const marcados = new Set(selecionados);
  const noticia = tipo === 'noticia';

  return (
    <>
      <form action={salvarConteudo} encType="multipart/form-data">
        {conteudo ? <input type="hidden" name="id" value={conteudo.id} /> : null}
        <fieldset disabled={lido} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="campo">
            <label>Tipo de conteúdo</label>
            <div className="opcoes-tipo" role="radiogroup" aria-label="Tipo de conteúdo">
              {TIPOS.map((t) => (
                <label key={t}>
                  <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                  <b>{ROTULO_TIPO[t]}</b>
                  {AJUDA_TIPO[t]}
                </label>
              ))}
            </div>
          </div>

          <div className="grade g2" style={{ marginTop: 14 }}>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="titulo">Título</label>
              <input id="titulo" name="titulo" defaultValue={conteudo?.titulo ?? ''} maxLength={160} required autoComplete="off" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="descricao">
                {noticia ? 'Resumo com as suas palavras' : 'Descrição curta'}{' '}
                <span className="un">{noticia ? 'obrigatório para publicar — não copie o texto da matéria' : 'o que o aluno vai aprender'}</span>
              </label>
              <textarea id="descricao" name="descricao" rows={noticia ? 4 : 2} defaultValue={conteudo?.descricao ?? ''} maxLength={2000} />
            </div>

            {tipo === 'video' || tipo === 'material' || noticia ? (
              <div className="campo" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="url">
                  {tipo === 'video' ? 'Link do vídeo' : noticia ? 'Link da matéria original' : 'Link do material'}{' '}
                  <span className="un">começa com https://{tipo === 'material' ? ' — ou envie o arquivo abaixo' : ''}</span>
                </label>
                <input id="url" name="url" type="url" inputMode="url" defaultValue={conteudo?.url ?? ''} placeholder="https://" autoComplete="off" />
              </div>
            ) : null}

            {tipo === 'artigo' ? (
              <div className="campo" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="corpo">Texto do artigo</label>
                <textarea id="corpo" name="corpo" rows={12} defaultValue={conteudo?.corpo ?? ''} maxLength={20000} />
                <small className="nota">Texto simples. Para separar parágrafos, deixe uma linha em branco.</small>
              </div>
            ) : null}

            {tipo === 'material' ? (
              <div className="campo" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="arquivo">Arquivo <span className="un">PDF, JPG, PNG ou WebP — até 10 MB</span></label>
                {conteudo?.arquivo_path ? (
                  <p className="nota" style={{ margin: '0 0 6px' }}>
                    Já tem um arquivo{arquivoUrl ? <> — <a href={arquivoUrl} target="_blank" rel="noopener noreferrer">abrir</a></> : null}. Enviar outro substitui.{' '}
                    <label className="conferi" style={{ display: 'inline-flex', marginTop: 0 }}>
                      <input type="checkbox" name="remover_arquivo" /> remover o arquivo
                    </label>
                  </p>
                ) : null}
                <input id="arquivo" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
              </div>
            ) : null}

            {noticia ? (
              <>
                <div className="campo">
                  <label htmlFor="data_materia">Data da matéria <span className="un">opcional</span></label>
                  <input id="data_materia" name="data_materia" type="date" defaultValue={conteudo?.data_materia ?? ''} />
                </div>
                <div className="campo">
                  <label htmlFor="regiao">Região <span className="un">opcional</span></label>
                  <input id="regiao" name="regiao" defaultValue={conteudo?.regiao ?? ''} maxLength={80} placeholder="Ex.: Norte do Espírito Santo" autoComplete="off" />
                </div>
              </>
            ) : null}

            <div className="campo">
              <label htmlFor="cultura">Cultura <span className="un">opcional{visibilidade === 'cultura' ? ' — obrigatória para "por cultura"' : ''}</span></label>
              <input id="cultura" name="cultura" defaultValue={conteudo?.cultura ?? ''} maxLength={60} placeholder="café, milho, soja…" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="tema">Tema</label>
              <select id="tema" name="tema" defaultValue={conteudo?.tema ?? ''}>
                <option value="">— sem tema —</option>
                {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="nivel">Nível</label>
              <select id="nivel" name="nivel" defaultValue={conteudo?.nivel ?? 'basico'}>
                {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="duracao_min">Duração <span className="un">minutos, opcional — entra na carga horária do curso</span></label>
              <input id="duracao_min" name="duracao_min" inputMode="numeric" defaultValue={conteudo?.duracao_min ?? ''} maxLength={3} autoComplete="off" />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="fonte">
                {noticia ? 'Fonte (site ou veículo)' : 'Autoria / fonte'}{' '}
                <span className="un">{noticia ? 'obrigatória para publicar' : 'quem produziu — respeite os direitos do autor'}</span>
              </label>
              <input id="fonte" name="fonte" defaultValue={conteudo?.fonte ?? ''} maxLength={300} placeholder={noticia ? 'Ex.: Incaper, Embrapa, Notícias Agrícolas' : 'Ex.: produzido pelo escritório · Embrapa (link acima)'} autoComplete="off" />
            </div>
          </div>

          <div className="campo" style={{ marginTop: 14 }}>
            <label>Quem pode ver</label>
            <div className="opcoes-tipo" role="radiogroup" aria-label="Quem pode ver">
              <label>
                <input type="radio" name="visibilidade" value="todos" checked={visibilidade === 'todos'} onChange={() => setVisibilidade('todos')} />
                <b>Todos os meus produtores</b>Aparece na Academy de todos.
              </label>
              <label>
                <input type="radio" name="visibilidade" value="cultura" checked={visibilidade === 'cultura'} onChange={() => setVisibilidade('cultura')} />
                <b>Quem tem a cultura</b>Só quem tem talhão da cultura acima (“café” alcança café-conilon e café-arábica).
              </label>
              <label>
                <input type="radio" name="visibilidade" value="selecionados" checked={visibilidade === 'selecionados'} onChange={() => setVisibilidade('selecionados')} />
                <b>Só os que eu escolher</b>Os outros não veem. Quem receber uma indicação também passa a ver.
              </label>
            </div>
          </div>

          {visibilidade === 'selecionados' ? (
            <div className="campo" style={{ marginTop: 10 }}>
              <label>Produtores com acesso <span className="un">{produtores.length} cadastrado(s)</span></label>
              {produtores.length === 0 ? (
                <p className="nota">Nenhum produtor cadastrado ainda.</p>
              ) : (
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
                <button className="btn verde" type="submit" name="intencao" value="publicar">Publicar</button>
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

      {podeEditar && conteudo ? (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--grafite)' }}>Excluir este conteúdo</summary>
          <form action={excluirConteudo} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={conteudo.id} />
            <p className="nota" style={{ margin: '0 0 8px' }}>Apaga o conteúdo, o arquivo e as indicações feitas aos produtores. Para só tirar do ar, use <b>Arquivar</b>. Se ele for aula de um curso, tire-o do curso antes.</p>
            <button className="btn perigo mini" type="submit">Confirmar exclusão</button>
          </form>
        </details>
      ) : null}
    </>
  );
}
