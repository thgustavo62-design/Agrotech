import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { PERFIS, perfisValidos } from '@/lib/permissoes';
import { Cartao } from '@/components/ui';
import { BotaoSair } from '@/components/botao-sair';
import { ChipsPerfis } from '@/components/chips-perfis';
import { salvarPerfilConsultor } from './acoes';
import { FormSenha } from './form-senha';

export const dynamic = 'force-dynamic';

/** Seção "Meu perfil": quem assina os laudos, o acesso desta pessoa, a senha e a saída. */
export default async function ConfigPerfil() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const { data: completo } = perfil
    ? await sb.schema('agro').from('profiles').select('nome, titulo, crea, art, fone').eq('id', perfil.id).single()
    : { data: null };
  const meus = perfisValidos(perfil?.perfis);

  return (
    <>
      <Cartao olho="Responsável técnico" titulo="Seus dados">
        <p className="nota" style={{ margin: '0 0 14px' }}>Nome, CREA e ART assinam todo laudo emitido por você.</p>
        <form action={salvarPerfilConsultor} className="grade g2">
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" defaultValue={completo?.nome ?? ''} required autoComplete="name" />
          </div>
          <div className="campo">
            <label htmlFor="titulo">Cargo <span className="un">(opcional)</span></label>
            <input id="titulo" name="titulo" defaultValue={completo?.titulo ?? ''} placeholder="Engenheiro agrônomo, técnico…" maxLength={60} autoComplete="organization-title" />
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
            <input id="fone" name="fone" type="tel" defaultValue={completo?.fone ?? ''} autoComplete="tel" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn verde" type="submit">Salvar</button>
          </div>
        </form>
      </Cartao>

      <Cartao olho="Seu acesso" titulo="O que você pode fazer aqui">
        <ChipsPerfis perfis={meus} />
        <ul className="nota" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
          {meus.flatMap((id) => PERFIS[id].pode).filter((t, i, a) => a.indexOf(t) === i).map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="nota" style={{ margin: '12px 0 0' }}>
          Quem define o acesso é o proprietário do escritório, em <b>Equipe e permissões</b>.
        </p>
      </Cartao>

      <Cartao olho="Segurança" titulo="Trocar a senha">
        <FormSenha />
      </Cartao>

      <Cartao olho="Sessão" titulo="Sair da conta">
        <p className="nota" style={{ margin: '0 0 14px' }}>
          Encerra o acesso deste dispositivo. Você pode entrar novamente a qualquer momento.
        </p>
        <BotaoSair className="btn" rotulo="Sair da conta" />
      </Cartao>
    </>
  );
}
