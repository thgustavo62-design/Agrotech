import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { FICHAS } from '@/lib/atlas-base';
import { listarFichasDoEstudio } from '@/lib/atlas-dados';
import { ROTULO_STATUS_FICHA, ROTULO_TIPO_FICHA } from '@/lib/atlas-escritorio';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function EstudioDoAtlas() {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const fichas = await listarFichasDoEstudio(sb);
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Atlas"
        titulo="Fichas do Atlas"
        descricao={`As ${FICHAS.length} fichas-base da Embrapa já aparecem para todos. Aqui você escreve as do seu escritório, a partir do seu manual técnico, com fotos próprias.`}
        acoes={podeEditar ? <Link className="btn verde" href="/academy/estudio/atlas/novo">Nova ficha</Link> : undefined}
      />
      <Cartao olho={`${fichas.length} ficha(s) do escritório`} titulo="Do seu escritório">
        {fichas.length === 0 ? (
          <Vazio titulo="Nenhuma ficha do escritório ainda">
            {podeEditar ? <>Comece por <Link href="/academy/estudio/atlas/novo">escrever a primeira ficha</Link>.</> : 'Quem tem permissão no Estúdio pode escrever as fichas.'}
          </Vazio>
        ) : (
          <div className="lista">
            {fichas.map((f) => {
              const s = ROTULO_STATUS_FICHA[f.status];
              return (
                <div className="item" key={f.id}>
                  <div className="cresce">
                    <h3>{f.nome}</h3>
                    <small>
                      {ROTULO_TIPO_FICHA[f.tipo]}{f.cultura ? ` · ${f.cultura}` : ''} · {f.n_fotos} foto(s)
                      {f.atualizado_em ? ` · atualizada em ${dataBR(f.atualizado_em.slice(0, 10))}` : ''}
                    </small>
                  </div>
                  <Tag tom={s.tom}>{s.txt}</Tag>
                  <Link className="btn sec mini" href={`/academy/estudio/atlas/${f.id}`}>{podeEditar ? 'Editar' : 'Abrir'}</Link>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}
