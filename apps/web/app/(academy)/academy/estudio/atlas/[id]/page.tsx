import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { carregarFichaCompleta } from '@/lib/atlas-dados';
import { MAX_FOTOS_DA_FICHA, ROTULO_STATUS_FICHA } from '@/lib/atlas-escritorio';
import { CabecalhoVista, Cartao, Tag } from '@/components/ui';
import { FormFicha } from '@/components/atlas/form-ficha';
import { CampoAnexos } from '@/components/connect/campo-anexos';
import { BotaoEnviar } from '@/components/connect/botao-enviar';
import { enviarFotos, removerFoto } from '../acoes';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaDoEstudio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const c = await carregarFichaCompleta(sb, id);
  if (!c) notFound();
  const { bruta, fotos } = c;
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');
  const s = ROTULO_STATUS_FICHA[bruta.status];

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Atlas"
        titulo={bruta.nome}
        descricao={<><Tag tom={s.tom}>{s.txt}</Tag> {bruta.status === 'publicado' ? 'Os produtores já veem esta ficha.' : 'Só a equipe vê esta ficha.'}</>}
        acoes={<Link className="btn sec" href={`/academy/atlas/${bruta.id}`}>Ver como o aluno vê</Link>}
      />

      <Cartao olho="Fotos" titulo={`Fotos da ficha (${fotos.length} de ${MAX_FOTOS_DA_FICHA})`}>
        {fotos.length === 0 ? (
          <p className="nota">Ainda sem fotos. Uma ficha só pode ser publicada com pelo menos uma.</p>
        ) : (
          <ul className="ac-estudio-fotos">
            {fotos.map((f) => (
              <li key={f.id}>
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto privada assinada (1 h)
                  <img src={f.url} alt={f.legenda ?? `Foto da ficha ${bruta.nome}`} loading="lazy" />
                ) : <span className="nota">indisponível</span>}
                {f.legenda ? <small>{f.legenda}</small> : null}
                {podeEditar ? (
                  <form action={removerFoto}>
                    <input type="hidden" name="foto_id" value={f.id} />
                    <button className="btn sec mini" type="submit">Remover</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && fotos.length < MAX_FOTOS_DA_FICHA ? (
          <form action={enviarFotos} className="ac-estudio-envio">
            <input type="hidden" name="ficha_id" value={bruta.id} />
            <CampoAnexos rotulo="Adicionar fotos" />
            <div className="campo">
              <label htmlFor="legenda">Legenda <span className="un">opcional, vale para as fotos deste envio</span></label>
              <input id="legenda" name="legenda" maxLength={200} autoComplete="off" />
            </div>
            <div><BotaoEnviar>Enviar fotos</BotaoEnviar></div>
          </form>
        ) : null}
      </Cartao>

      <Cartao olho="Texto" titulo="A ficha" style={{ marginTop: 14 }}>
        <FormFicha ficha={bruta} nFotos={fotos.length} podeEditar={podeEditar} />
      </Cartao>
    </>
  );
}
