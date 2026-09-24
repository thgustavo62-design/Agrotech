import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag, Vazio } from '@/components/ui';
import { criarEvento, mudarStatusEvento } from './acoes';

export const dynamic = 'force-dynamic';

const ROTULO_TIPO: Record<string, string> = {
  visita: 'Visita', coleta_solo: 'Coleta de solo', retorno: 'Retorno',
  aplicacao: 'Aplicação', reuniao: 'Reunião', outro: 'Outro',
};

type Evento = {
  id: string; tipo: string; titulo: string; data: string; hora: string | null; status: string; observacao: string | null;
  produtor: { nome: string } | null; talhao: { nome: string } | null;
};

export default async function Agenda() {
  const sb = await criarClienteServidor();

  const [{ data: eventosRaw }, { data: produtoresRaw }, { data: talhoesRaw }] = await Promise.all([
    sb.schema('agro').from('agenda_eventos')
      .select('id, tipo, titulo, data, hora, status, observacao, produtor:produtor_id(nome), talhao:talhao_id(nome)')
      .order('data', { ascending: true }).order('hora', { ascending: true }),
    sb.schema('agro').from('produtores').select('id, nome').order('nome'),
    sb.schema('agro').from('talhoes').select('id, nome, propriedade:propriedade_id(produtor:produtor_id(nome))').order('nome'),
  ]);

  const eventos = (eventosRaw ?? []) as unknown as Evento[];
  const produtores = (produtoresRaw ?? []) as Array<{ id: string; nome: string }>;
  const talhoes = (talhoesRaw ?? []) as unknown as Array<{ id: string; nome: string; propriedade: { produtor: { nome: string } | null } | null }>;

  const hojeISO = new Date().toISOString().slice(0, 10);
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const planejados = eventos.filter((e) => e.status === 'planejado');
  const atrasados = planejados.filter((e) => e.data < hojeISO);
  const hoje = planejados.filter((e) => e.data === hojeISO);
  const proximos7 = planejados.filter((e) => e.data > hojeISO && e.data <= em7dias);
  const depois = planejados.filter((e) => e.data > em7dias);
  const historico = eventos.filter((e) => e.status !== 'planejado').slice(0, 10);

  const grupo = (titulo: string, lista: Evento[], tom: 'ok' | 'alerta' | 'ruim' | 'cinza') => lista.length === 0 ? null : (
    <Cartao olho={`${lista.length} evento(s)`} titulo={titulo} style={{ marginTop: 14 }}>
      <div className="lista">
        {lista.map((e) => (
          <div className="item" key={e.id}>
            <div className="cresce">
              <h3>{e.titulo}</h3>
              <small>
                {dataBR(e.data)}{e.hora ? ` às ${e.hora.slice(0, 5)}` : ''} · {ROTULO_TIPO[e.tipo] ?? e.tipo}
                {e.produtor ? ` · ${e.produtor.nome}` : ''}{e.talhao ? ` · ${e.talhao.nome}` : ''}
              </small>
              {e.observacao ? <p className="nota" style={{ margin: '4px 0 0' }}>{e.observacao}</p> : null}
            </div>
            <Tag tom={tom}>{ROTULO_TIPO[e.tipo] ?? e.tipo}</Tag>
            <form action={mudarStatusEvento}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="status" value="concluido" />
              <button className="btn sec mini" type="submit">concluir</button>
            </form>
            <form action={mudarStatusEvento}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="status" value="cancelado" />
              <button className="btn sec mini" type="submit">cancelar</button>
            </form>
          </div>
        ))}
      </div>
    </Cartao>
  );

  return (
    <>
      <CabecalhoVista
        olho="Sua rotina"
        titulo="Agenda"
        descricao="Visitas, coletas de solo, retornos e aplicações — o que vem por aí."
      />

      {planejados.length === 0 ? <Vazio titulo="Nada agendado" /> : null}
      {grupo('Atrasados', atrasados, 'ruim')}
      {grupo('Hoje', hoje, 'alerta')}
      {grupo('Próximos 7 dias', proximos7, 'cinza')}
      {grupo('Depois', depois, 'cinza')}

      <Cartao olho="Novo" titulo="Agendar" style={{ marginTop: 14 }}>
        <form action={criarEvento} className="grade g2">
          <div className="campo">
            <label htmlFor="e_tipo">Tipo</label>
            <select id="e_tipo" name="tipo" required defaultValue="visita">
              {Object.entries(ROTULO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="campo"><label htmlFor="e_titulo">Título</label><input id="e_titulo" name="titulo" required autoComplete="off" /></div>
          <div className="campo"><label htmlFor="e_data">Data</label><input id="e_data" name="data" type="date" required /></div>
          <div className="campo"><label htmlFor="e_hora">Hora (opcional)</label><input id="e_hora" name="hora" type="time" /></div>
          <div className="campo">
            <label htmlFor="e_prod">Produtor (opcional)</label>
            <select id="e_prod" name="produtor_id" defaultValue="">
              <option value="">—</option>
              {produtores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="e_talhao">Talhão (opcional)</label>
            <select id="e_talhao" name="talhao_id" defaultValue="">
              <option value="">—</option>
              {talhoes.map((t) => <option key={t.id} value={t.id}>{t.nome} — {t.propriedade?.produtor?.nome ?? '—'}</option>)}
            </select>
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="e_obs">Observação (opcional)</label>
            <input id="e_obs" name="observacao" autoComplete="off" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}><button className="btn verde" type="submit">Agendar</button></div>
        </form>
      </Cartao>

      {historico.length > 0 && (
        <Cartao olho="Últimos 10" titulo="Histórico recente" style={{ marginTop: 14 }}>
          <div className="lista">
            {historico.map((e) => (
              <div className="item" key={e.id}>
                <div className="cresce">
                  <h3>{e.titulo}</h3>
                  <small>{dataBR(e.data)} · {ROTULO_TIPO[e.tipo] ?? e.tipo}{e.produtor ? ` · ${e.produtor.nome}` : ''}</small>
                </div>
                <Tag tom={e.status === 'concluido' ? 'ok' : 'cinza'}>{e.status === 'concluido' ? 'concluído' : 'cancelado'}</Tag>
              </div>
            ))}
          </div>
        </Cartao>
      )}
    </>
  );
}
