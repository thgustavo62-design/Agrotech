import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { Cartao } from '@/components/ui';
import { salvarEscritorio } from '../acoes';

export const dynamic = 'force-dynamic';

/** Seção "Escritório": identidade do escritório (aparece nos laudos). Edita só quem tem `escritorio.editar`. */
export default async function ConfigEscritorio() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const { data: org } = perfil?.org_id
    ? await sb.schema('agro').from('orgs').select('nome, municipio, uf').eq('id', perfil.org_id).maybeSingle()
    : { data: null };
  const editar = pode(perfil?.perfis, 'escritorio.editar');

  return (
    <Cartao olho="Escritório" titulo={org?.nome ?? 'Sem organização'}>
      <p className="nota" style={{ margin: '0 0 14px' }}>
        {editar
          ? 'O nome e o município do escritório aparecem nos laudos e na página que o produtor recebe.'
          : 'Só o proprietário altera os dados do escritório. Você pode consultá-los aqui.'}
      </p>
      <form action={salvarEscritorio} className="grade g2">
        <fieldset disabled={!editar} style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}>
          <div className="campo">
            <label htmlFor="org_nome">Nome do escritório</label>
            <input id="org_nome" name="nome" defaultValue={org?.nome ?? ''} required autoComplete="organization" />
          </div>
          <div className="campo">
            <label htmlFor="org_municipio">Município</label>
            <input id="org_municipio" name="municipio" defaultValue={org?.municipio ?? ''} autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="org_uf">UF</label>
            <input id="org_uf" name="uf" defaultValue={org?.uf ?? ''} maxLength={2} style={{ textTransform: 'uppercase' }} autoComplete="off" />
          </div>
          {editar ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn verde" type="submit">Salvar escritório</button>
            </div>
          ) : null}
        </fieldset>
      </form>
    </Cartao>
  );
}
