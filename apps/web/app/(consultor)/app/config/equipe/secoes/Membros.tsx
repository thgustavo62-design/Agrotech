import { Cartao, Tag, Vazio } from '@/components/ui';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { ChipsPerfis } from '@/components/chips-perfis';
import { alterarPerfis, removerDaEquipe } from '../acoes';
import type { ContextoEquipe } from '../dados';
import { SeletorPerfis } from './SeletorPerfis';
import { GerarAcesso } from './GerarAcesso';

/** Quem já está no escritório, com o perfil de cada um; o proprietário edita o acesso ou remove. */
export function SecaoMembros({ ctx }: { ctx: ContextoEquipe }) {
  const { membros, eu, gerencia } = ctx;
  return (
    <Cartao olho={`${membros.length} pessoa(s)`} titulo="Quem acessa o painel">
      {membros.length === 0 ? (
        <Vazio titulo="Nenhum integrante encontrado" />
      ) : (
        <div className="lista">
          {membros.map((m) => {
            const sou = m.id === eu?.id;
            return (
              <div className="membro" key={m.id}>
                <div className="membro-topo">
                  <AvatarUsuario nome={m.nome} />
                  <div className="cresce">
                    <h3>{m.nome ?? 'Sem nome'} {sou ? <Tag tom="cinza">você</Tag> : null}</h3>
                    <small>{m.titulo ?? 'Sem cargo definido'}{m.crea ? ` · CREA ${m.crea}` : ''}</small>
                  </div>
                </div>
                <ChipsPerfis perfis={m.perfis} />
                {gerencia && !sou ? (
                  <>
                    <details>
                      <summary>Alterar acesso</summary>
                      <form action={alterarPerfis}>
                        <input type="hidden" name="id" value={m.id} />
                        <SeletorPerfis idBase={`p-${m.id}`} marcados={m.perfis} />
                        <button className="btn verde mini" type="submit">Salvar acesso</button>
                      </form>
                    </details>
                    {!m.perfis.includes('proprietario') ? (
                      <details>
                        <summary>Senha esquecida</summary>
                        <GerarAcesso id={m.id} nome={m.nome} site={ctx.site} />
                      </details>
                    ) : null}
                    <details className="perigo">
                      <summary>Remover do escritório</summary>
                      <form action={removerDaEquipe}>
                        <input type="hidden" name="id" value={m.id} />
                        <p className="nota" style={{ margin: '4px 0 10px' }}>
                          {m.nome ?? 'A pessoa'} perde o acesso aos produtores e análises do escritório imediatamente. Os dados continuam com o escritório.
                        </p>
                        <button className="btn sec mini" type="submit">Confirmar remoção</button>
                      </form>
                    </details>
                  </>
                ) : null}
                {gerencia && sou ? (
                  <p className="nota" style={{ margin: '8px 0 0' }}>Para mudar o seu acesso, peça a outro proprietário.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Cartao>
  );
}
