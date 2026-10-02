import { nomeCultura } from '@/lib/culturas';
import { Cartao, Tag } from '@/components/ui';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { criarCompartilhamento, alternarCompartilhamento, convidarProdutor, excluirProdutor } from '../acoes';
import type { ContextoProdutor } from '../dados';

export function PainelAcesso({ ctx }: { ctx: ContextoProdutor }) {
  const { id, prod, comps, convites, culturasOrdenadas, appUrl } = ctx;

  return (
    (
      <>
        <Cartao olho="Acesso do produtor" titulo="Links de resultados">
          <p className="nota" style={{ margin: '0 0 12px' }}>
            Gera um endereço que o produtor abre sem login e vê os resultados em tempo real — a lavoura
            toda ou uma cultura só.
          </p>
          {(comps ?? []).length > 0 && (
            <div className="lista" style={{ marginBottom: 14 }}>
              {(comps ?? []).map((c) => (
                <div className="item" key={c.id as string}>
                  <div className="cresce" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <strong>{(c.rotulo as string) || nomeCultura((c.cultura as string) ?? null)}</strong>{' '}
                      {c.cultura ? <Tag tom="cinza">{nomeCultura(c.cultura as string)}</Tag> : <Tag>lavoura toda</Tag>}{' '}
                      <span className="nota">{c.acessos as number} acesso(s)</span>
                    </div>
                    <LinkCompartilhado url={`${appUrl}/r/${c.token}`} />
                  </div>
                  <form action={alternarCompartilhamento}>
                    <input type="hidden" name="id" value={c.id as string} />
                    <input type="hidden" name="produtor_id" value={id} />
                    <input type="hidden" name="ativo" value={String(c.ativo)} />
                    <button className="btn sec mini" type="submit">{c.ativo ? 'desativar' : 'reativar'}</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={criarCompartilhamento} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input type="hidden" name="produtor_id" value={id} />
            <div className="campo" style={{ minWidth: 200 }}>
              <label htmlFor="cultura">Escopo</label>
              <select id="cultura" name="cultura" defaultValue="__todas">
                <option value="__todas">Lavoura toda</option>
                {culturasOrdenadas.filter((c) => c !== '__sem').map((c) => (
                  <option key={c} value={c}>{nomeCultura(c)}</option>
                ))}
              </select>
            </div>
            <div className="campo" style={{ minWidth: 200 }}>
              <label htmlFor="rotulo">Rótulo (opcional)</label>
              <input id="rotulo" name="rotulo" placeholder="ex.: Safra 2026" autoComplete="off" />
            </div>
            <button className="btn verde" type="submit">Gerar link</button>
          </form>

          <hr style={{ border: 0, borderTop: '1px solid var(--linha)', margin: '18px 0 14px' }} />

          <h3 style={{ margin: '0 0 6px' }}>Portal com login próprio</h3>
          {prod.user_id ? (
            <p className="nota">
              <Tag tom="ok">acesso ativo</Tag> Este produtor já tem login e vê os talhões e laudos dele.
            </p>
          ) : (
            <>
              <p className="nota" style={{ margin: '0 0 10px' }}>
                Diferente do link acima: o produtor cria uma senha e entra em <code>/produtor</code>.
                Convite válido por 7 dias.
              </p>
              {(convites ?? []).some((cv) => !cv.usado_em) && (
                <p className="nota">Convite pendente para {(convites ?? []).find((cv) => !cv.usado_em)?.email}.</p>
              )}
              <form action={convidarProdutor} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <input type="hidden" name="produtor_id" value={id} />
                <div className="campo" style={{ minWidth: 240 }}>
                  <label htmlFor="conv_email">E-mail do produtor</label>
                  <input id="conv_email" name="email" type="email" defaultValue={prod.email ?? ''} required autoComplete="off" />
                </div>
                <button className="btn verde" type="submit">Enviar convite</button>
              </form>
            </>
          )}
        </Cartao>

        <Cartao olho="Zona de risco" titulo="Excluir produtor (LGPD)" style={{ marginTop: 14 }}>
          <p className="nota" style={{ margin: '0 0 10px' }}>
            Atende ao pedido de eliminação do titular. Apaga <b>em definitivo</b> o produtor e tudo abaixo:
            propriedades, talhões, análises, recomendações e visitas. Não dá para desfazer.
            A ação fica registrada na trilha de auditoria.
          </p>
          <form action={excluirProdutor} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={id} />
            <div className="campo" style={{ minWidth: 200 }}>
              <label htmlFor="confirmar">Digite <code>EXCLUIR</code> para confirmar</label>
              <input id="confirmar" name="confirmar" autoComplete="off" placeholder="EXCLUIR" />
            </div>
            <button className="btn" style={{ background: 'var(--c-mb)', borderColor: 'var(--c-mb)' }} type="submit">
              Excluir definitivamente
            </button>
          </form>
        </Cartao>
      </>
    )
  );
}
