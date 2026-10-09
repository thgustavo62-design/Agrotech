import { Cartao, Tag } from '@/components/ui';
import { ROTULO_TIPO, type StatusConteudo, type TipoConteudo } from '@/lib/academy';
import { formatarCarga } from '@/lib/academy-cursos';
import { adicionarAula, adicionarModulo, moverAula, moverModulo, removerAula, removerModulo, renomearModulo } from '../acoes';

export interface AulaLinha {
  id: string;
  conteudo_id: string;
  titulo: string;
  tipo: TipoConteudo;
  status: StatusConteudo;
  duracao_min: number | null;
}
export interface ModuloLinha { id: string; titulo: string; aulas: AulaLinha[] }
export interface ConteudoDisponivel { id: string; titulo: string; tipo: TipoConteudo; duracao_min: number | null }

/** Montar o curso: módulos, aulas (conteúdos da biblioteca) e a ordem. Cada botão é uma ação pequena e clara. */
export function Estrutura({ cursoId, modulos, disponiveis, podeEditar }: {
  cursoId: string;
  modulos: ModuloLinha[];
  disponiveis: ConteudoDisponivel[];
  podeEditar: boolean;
}) {
  const aulas = modulos.flatMap((m) => m.aulas);
  const carga = aulas.reduce((s, a) => s + (a.duracao_min ?? 0), 0);
  const rascunhos = aulas.filter((a) => a.status !== 'publicado').length;

  return (
    <div id="estrutura">
      <Cartao olho="Estrutura" titulo="Módulos e aulas">
        <p className="nota" style={{ marginTop: 0 }}>
          {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'} em {modulos.length} {modulos.length === 1 ? 'módulo' : 'módulos'}
          {carga > 0 ? ` · carga prevista ${formatarCarga(carga)} (soma da duração dos conteúdos)` : ''}.
          Cada aula é um conteúdo da biblioteca; o mesmo conteúdo pode estar em vários cursos.
        </p>
        {rascunhos > 0 ? <div className="aviso" style={{ marginBottom: 12 }}>{rascunhos} aula(s) ainda não estão publicadas. O curso só pode ser publicado quando todas estiverem.</div> : null}

        {modulos.length === 0 ? <p className="nota">O curso ainda não tem módulos. Crie o primeiro abaixo.</p> : null}

        {modulos.map((m, i) => (
          <details className="ac-modulo" key={m.id} open>
            <summary>
              <span>{i + 1}. {m.titulo}</span>
              <small>{m.aulas.length} {m.aulas.length === 1 ? 'aula' : 'aulas'}</small>
            </summary>
            <div style={{ padding: '12px 16px' }}>
              {podeEditar ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <form action={renomearModulo} style={{ display: 'flex', gap: 6, flex: '1 1 260px' }}>
                    <input type="hidden" name="curso_id" value={cursoId} />
                    <input type="hidden" name="modulo_id" value={m.id} />
                    <input name="titulo" defaultValue={m.titulo} maxLength={160} aria-label={`Nome do módulo ${i + 1}`} style={{ flex: 1 }} />
                    <button className="btn sec mini" type="submit">Renomear</button>
                  </form>
                  <div className="ac-ordem">
                    <form action={moverModulo}><input type="hidden" name="curso_id" value={cursoId} /><input type="hidden" name="modulo_id" value={m.id} /><input type="hidden" name="direcao" value="subir" /><button type="submit" disabled={i === 0} aria-label="Subir módulo">↑</button></form>
                    <form action={moverModulo}><input type="hidden" name="curso_id" value={cursoId} /><input type="hidden" name="modulo_id" value={m.id} /><input type="hidden" name="direcao" value="descer" /><button type="submit" disabled={i === modulos.length - 1} aria-label="Descer módulo">↓</button></form>
                  </div>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--grafite)' }}>Remover módulo</summary>
                    <form action={removerModulo} style={{ marginTop: 6 }}>
                      <input type="hidden" name="curso_id" value={cursoId} />
                      <input type="hidden" name="modulo_id" value={m.id} />
                      <button className="btn perigo mini" type="submit">Remover o módulo e tirar as {m.aulas.length} aula(s) do curso</button>
                    </form>
                  </details>
                </div>
              ) : null}

              {m.aulas.length === 0 ? <p className="nota" style={{ margin: '0 0 10px' }}>Nenhuma aula neste módulo.</p> : (
                <ul className="ac-linhas" style={{ border: '1px solid var(--linha)', borderRadius: 10, marginBottom: 12 }}>
                  {m.aulas.map((a, j) => (
                    <li className="ac-linha" key={a.id} style={{ borderTop: j === 0 ? 0 : undefined }}>
                      <b>{a.titulo}</b>
                      <small style={{ marginLeft: 0 }}>{ROTULO_TIPO[a.tipo]}{a.duracao_min ? ` · ${formatarCarga(a.duracao_min)}` : ''}</small>
                      {a.status !== 'publicado' ? <Tag tom="alerta">{a.status}</Tag> : null}
                      {podeEditar ? (
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="ac-ordem">
                            <form action={moverAula}><input type="hidden" name="curso_id" value={cursoId} /><input type="hidden" name="modulo_id" value={m.id} /><input type="hidden" name="aula_id" value={a.id} /><input type="hidden" name="direcao" value="subir" /><button type="submit" disabled={j === 0} aria-label={`Subir ${a.titulo}`}>↑</button></form>
                            <form action={moverAula}><input type="hidden" name="curso_id" value={cursoId} /><input type="hidden" name="modulo_id" value={m.id} /><input type="hidden" name="aula_id" value={a.id} /><input type="hidden" name="direcao" value="descer" /><button type="submit" disabled={j === m.aulas.length - 1} aria-label={`Descer ${a.titulo}`}>↓</button></form>
                          </span>
                          <form action={removerAula}><input type="hidden" name="curso_id" value={cursoId} /><input type="hidden" name="aula_id" value={a.id} /><button className="btn sec mini" type="submit">tirar</button></form>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {podeEditar ? (
                disponiveis.length === 0 ? (
                  <p className="nota" style={{ margin: 0 }}>Não há conteúdo publicado livre para adicionar. Publique um na aba <b>Conteúdos</b>.</p>
                ) : (
                  <form action={adicionarAula} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <input type="hidden" name="curso_id" value={cursoId} />
                    <input type="hidden" name="modulo_id" value={m.id} />
                    <select name="conteudo_id" required defaultValue="" aria-label={`Conteúdo para adicionar ao módulo ${i + 1}`} style={{ flex: '1 1 280px' }}>
                      <option value="" disabled>Escolha um conteúdo publicado…</option>
                      {disponiveis.map((c) => <option key={c.id} value={c.id}>{c.titulo} ({ROTULO_TIPO[c.tipo]}{c.duracao_min ? `, ${c.duracao_min} min` : ''})</option>)}
                    </select>
                    <button className="btn verde mini" type="submit">Adicionar aula</button>
                  </form>
                )
              ) : null}
            </div>
          </details>
        ))}

        {podeEditar ? (
          <form action={adicionarModulo} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <input type="hidden" name="curso_id" value={cursoId} />
            <input name="titulo" placeholder={modulos.length === 0 ? 'Nome do primeiro módulo (ex.: Introdução)' : 'Nome do novo módulo'} maxLength={160} required aria-label="Nome do novo módulo" style={{ flex: '1 1 280px' }} />
            <button className="btn verde" type="submit">Criar módulo</button>
          </form>
        ) : null}
      </Cartao>
    </div>
  );
}
