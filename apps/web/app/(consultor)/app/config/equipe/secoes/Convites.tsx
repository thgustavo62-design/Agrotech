import { Cartao } from '@/components/ui';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { ChipsPerfis } from '@/components/chips-perfis';
import { dataBR } from '@/lib/formato';
import { cancelarConviteEquipe, convidarEquipe } from '../acoes';
import type { ContextoEquipe } from '../dados';
import { SeletorPerfis } from './SeletorPerfis';

/** Convidar alguém (e-mail + perfis) e acompanhar os convites pendentes, com o link pronto para copiar/WhatsApp. */
export function SecaoConvites({ ctx }: { ctx: ContextoEquipe }) {
  const { plano, convites, site } = ctx;
  return (
    <>
      <Cartao olho="Novo" titulo="Cadastrar alguém da equipe">
        <p className="nota" style={{ margin: '0 0 14px' }}>
          A pessoa recebe um link, cria a própria senha e já entra com os perfis que você escolher aqui.
        </p>
        {plano.cheio ? (
          <p className="aviso">
            O plano {plano.nome ? `“${plano.nome}” ` : ''}está no limite de {plano.limite} usuário(s). Cancele um convite ou mude de plano para convidar mais gente.
          </p>
        ) : (
          <form action={convidarEquipe}>
            <div className="grade g2">
              <div className="campo">
                <label htmlFor="eq_email">E-mail</label>
                <input id="eq_email" name="email" type="email" required autoComplete="off" inputMode="email" />
              </div>
              <div className="campo">
                <label htmlFor="eq_titulo">Cargo <span className="un">(opcional)</span></label>
                <input id="eq_titulo" name="titulo" placeholder="Agrônomo, técnico de campo…" maxLength={60} autoComplete="off" />
              </div>
            </div>
            <label style={{ marginTop: 14 }}>O que esta pessoa vai poder fazer (pode marcar mais de um)</label>
            <SeletorPerfis idBase="novo" marcados={['leitura']} />
            <button className="btn verde" type="submit">Gerar convite</button>
          </form>
        )}
      </Cartao>

      {convites.length > 0 && (
        <Cartao olho={`${convites.length} pendente(s)`} titulo="Convites aguardando aceite">
          <div className="lista">
            {convites.map((c) => {
              const link = `${site}/equipe/aceitar?token=${c.token}`;
              const msg = `Oi! Você foi convidado para o escritório no AgroTech. Crie sua senha aqui: ${link}`;
              return (
                <div className="convite" key={c.id}>
                  <div className="convite-topo">
                    <div>
                      <b style={{ fontSize: 14.5 }}>{c.email}</b>
                      <div><small style={{ color: 'var(--grafite)' }}>{c.titulo ? `${c.titulo} · ` : ''}enviado em {dataBR(c.criado_em.slice(0, 10))} · vale até {dataBR(c.expira_em.slice(0, 10))}</small></div>
                    </div>
                    <div className="convite-acoes">
                      <a className="btn sec mini" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                      <form action={cancelarConviteEquipe}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn sec mini" type="submit">cancelar</button>
                      </form>
                    </div>
                  </div>
                  <ChipsPerfis perfis={c.perfis} />
                  <LinkCompartilhado url={link} />
                </div>
              );
            })}
          </div>
        </Cartao>
      )}
    </>
  );
}
