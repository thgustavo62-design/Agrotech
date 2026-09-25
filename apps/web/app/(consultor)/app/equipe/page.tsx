import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { Cartao, Tag, Vazio } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { convidarEquipe, cancelarConviteEquipe, removerDaEquipe } from './acoes';

export const dynamic = 'force-dynamic';

type Membro = { id: string; nome: string | null; crea: string | null; titulo: string | null; role: string };
type Convite = { id: string; email: string; titulo: string | null; expira_em: string; criado_em: string };

export default async function Equipe() {
  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();

  const [{ data: membrosRaw }, { data: convitesRaw }] = await Promise.all([
    perfil?.org_id
      ? sb.schema('agro').from('profiles').select('id, nome, crea, titulo, role').eq('org_id', perfil.org_id).order('nome')
      : Promise.resolve({ data: null }),
    perfil?.org_id
      ? sb.schema('agro').from('convites_equipe').select('id, email, titulo, expira_em, criado_em')
          .is('usado_em', null).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const membros = (membrosRaw ?? []) as Membro[];
  const convites = (convitesRaw ?? []) as Convite[];

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Escritório"
        titulo="Equipe"
        descricao="Convide colegas pro mesmo escritório — todo mundo enxerga os mesmos produtores, propriedades e análises. Permissão por papel ainda não existe: quem entra tem o mesmo acesso de hoje."
        tags={[`${membros.length} integrante(s)`, `${convites.length} convite(s) pendente(s)`]}
      />

      <Cartao olho={`${membros.length} integrante(s)`} titulo="Quem já está no escritório">
        {membros.length === 0 ? (
          <Vazio titulo="Nenhum integrante encontrado" />
        ) : (
          <div className="lista">
            {membros.map((m) => (
              <div className="item" key={m.id}>
                <AvatarUsuario nome={m.nome} />
                <div className="cresce">
                  <h3>{m.nome ?? 'Sem nome'} {m.id === perfil?.id ? <Tag tom="cinza">você</Tag> : null}</h3>
                  <small>{m.titulo ?? (m.id === perfil?.id ? 'Proprietário' : 'Sem título definido')}{m.crea ? ` · CREA ${m.crea}` : ''}</small>
                </div>
                {m.id !== perfil?.id && (
                  <form action={removerDaEquipe}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn sec mini" type="submit">remover</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao olho="Novo" titulo="Convidar alguém" style={{ marginTop: 14 }}>
        <form action={convidarEquipe} className="grade g2">
          <div className="campo">
            <label htmlFor="eq_email">E-mail</label>
            <input id="eq_email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="eq_titulo">Título (opcional)</label>
            <input id="eq_titulo" name="titulo" placeholder="Agrônomo, Técnico, Assistente…" autoComplete="off" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn verde" type="submit">Enviar convite</button>
          </div>
        </form>
      </Cartao>

      {convites.length > 0 && (
        <Cartao olho={`${convites.length} pendente(s)`} titulo="Convites enviados" style={{ marginTop: 14 }}>
          <div className="lista">
            {convites.map((c) => (
              <div className="item" key={c.id}>
                <div className="cresce">
                  <h3>{c.email}</h3>
                  <small>{c.titulo ? `${c.titulo} · ` : ''}enviado em {dataBR(c.criado_em.slice(0, 10))} · expira em {dataBR(c.expira_em.slice(0, 10))}</small>
                </div>
                <form action={cancelarConviteEquipe}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn sec mini" type="submit">cancelar</button>
                </form>
              </div>
            ))}
          </div>
        </Cartao>
      )}
    </>
  );
}
