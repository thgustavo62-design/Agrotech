import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { Cartao } from '@/components/ui';
import { BannerHero, FOTO_CONSULTOR } from '@/components/banner-hero';
import { salvarPerfilConsultor } from './acoes';

export const dynamic = 'force-dynamic';

export default async function Config() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const { data: org } = perfil?.org_id
    ? await sb.schema('agro').from('orgs').select('nome, municipio, uf').eq('id', perfil.org_id).maybeSingle()
    : { data: null };
  const { data: completo } = perfil
    ? await sb.schema('agro').from('profiles').select('nome, crea, art, fone').eq('id', perfil.id).single()
    : { data: null };

  return (
    <>
      <BannerHero imagem={FOTO_CONSULTOR}
        olho="Configurações"
        titulo="Seus dados"
        descricao="Nome, CREA e ART assinam todo laudo emitido pelo app."
        tags={['Perfil', 'Identidade', 'Assinatura']}
      />
      <Cartao olho="Responsável técnico" titulo="Perfil">
        <form action={salvarPerfilConsultor} className="grade g2">
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" defaultValue={completo?.nome ?? ''} required autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="crea">CREA</label>
            <input id="crea" name="crea" defaultValue={completo?.crea ?? ''} autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="art">ART</label>
            <input id="art" name="art" defaultValue={completo?.art ?? ''} autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="fone">Telefone</label>
            <input id="fone" name="fone" defaultValue={completo?.fone ?? ''} autoComplete="off" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn verde" type="submit">Salvar</button>
          </div>
        </form>
      </Cartao>

      <Cartao olho="Escritório" titulo={org?.nome ?? 'Sem organização'}>
        <p className="nota" style={{ margin: 0 }}>
          {org?.municipio ? `${org.municipio}/${org.uf ?? ''}` : 'Município não informado.'}
          {' '}Renomear o escritório ainda não é possível pelo app.
        </p>
      </Cartao>
    </>
  );
}
