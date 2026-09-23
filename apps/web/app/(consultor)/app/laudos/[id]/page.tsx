import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Grade, Tag, Vazio } from '@/components/ui';
import { confirmarLaudo, descartarLaudo } from './acoes';

export const dynamic = 'force-dynamic';

type CampoExtraido = { valor: number | null; confianca: number; origem: string; bruto?: string };
type Extracao = {
  perfil: string | null;
  laboratorio: string | null;
  campos: Partial<Record<string, CampoExtraido>>;
  identificacao: Record<string, string | null>;
  confianca_media: number;
  avisos: string[];
};

const CAMPOS: Array<[string, string, string]> = [
  ['argila', 'Argila', '%'], ['ph', 'pH', 'H₂O'], ['mo', 'M.O.', 'dag/kg'], ['p', 'P', 'mg/dm³'],
  ['k', 'K', 'mg/dm³'], ['na', 'Na', 'mg/dm³'], ['ca', 'Ca', 'cmolc/dm³'], ['mg', 'Mg', 'cmolc/dm³'],
  ['al', 'Al', 'cmolc/dm³'], ['h_al', 'H+Al', 'cmolc/dm³'], ['s', 'S', 'mg/dm³'], ['b', 'B', 'mg/dm³'],
  ['zn', 'Zn', 'mg/dm³'], ['cu', 'Cu', 'mg/dm³'], ['mn', 'Mn', 'mg/dm³'], ['fe', 'Fe', 'mg/dm³'],
];

function tomConfianca(c: number | undefined): { tom: 'ok' | 'alerta' | 'ruim' | 'cinza'; txt: string } {
  if (c == null) return { tom: 'cinza', txt: 'não encontrado' };
  if (c >= 0.9) return { tom: 'ok', txt: `${Math.round(c * 100)}% confiança` };
  if (c >= 0.8) return { tom: 'alerta', txt: `${Math.round(c * 100)}% — confira` };
  return { tom: 'ruim', txt: `${Math.round(c * 100)}% — confira` };
}

/** yyyy-mm-dd a partir de datas em formato BR ou ISO livre no laudo; senão vazio. */
function paraDataInput(bruto: string | null | undefined): string {
  if (!bruto) return '';
  const br = bruto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = bruto.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

export default async function ConferenciaLaudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();

  const { data: doc, error } = await sb.schema('agro').from('documentos').select('*').eq('id', id).single();
  if (error || !doc) notFound();

  if (doc.status === 'confirmado') {
    const { data: analise } = await sb.schema('agro').from('analises')
      .select('id').eq('documento_id', id).maybeSingle();
    return (
      <>
        <CabecalhoVista olho="Laudo" titulo={doc.nome_arquivo as string} descricao="Já conferido e confirmado." />
        <Vazio titulo="Este laudo virou análise">
          {analise ? (
            <Link className="btn verde mini" href={`/app/analises/${analise.id}`} style={{ marginTop: 10 }}>
              Abrir a análise
            </Link>
          ) : null}
        </Vazio>
      </>
    );
  }

  const { data: talhoesRaw } = await sb
    .schema('agro').from('talhoes')
    .select('id, nome, propriedade:propriedade_id(produtor:produtor_id(nome))')
    .order('nome');
  const talhoes = (talhoesRaw ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    // deno-lint-ignore no-explicit-any
    produtor: (t as any).propriedade?.produtor?.nome ?? '—',
  }));

  let urlPdf: string | null = null;
  if (doc.storage_path) {
    const { data: assinada } = await sb.storage.from('laudos').createSignedUrl(doc.storage_path as string, 3600);
    urlPdf = assinada?.signedUrl ?? null;
  }

  const extracao = (doc.payload ?? null) as Extracao | null;
  const campos = extracao?.campos ?? {};
  const ident = extracao?.identificacao ?? {};

  let candidatos: Array<{ id: string; nome: string; score: number }> = [];
  if (ident.produtor && perfil?.org_id) {
    const { data } = await sb.schema('agro').rpc('casar_produtor', { p_org: perfil.org_id, p_nome: ident.produtor });
    candidatos = (data ?? []) as typeof candidatos;
  }
  const melhorCandidato = candidatos[0];

  return (
    <>
      <CabecalhoVista
        olho="Conferência"
        titulo={doc.nome_arquivo as string}
        descricao="Confira os campos extraídos (destacados quando a confiança é baixa), escolha o talhão e confirme."
        acoes={
          <form action={descartarLaudo}>
            <input type="hidden" name="documento_id" value={id} />
            <button className="btn perigo mini" type="submit">Descartar laudo</button>
          </form>
        }
      />

      {doc.erro ? <div className="aviso" style={{ marginBottom: 14 }}>{doc.erro as string}</div> : null}

      {extracao && (
        <Grade cols={4} style={{ marginBottom: 14 }}>
          <div className="metrica"><span>Confiança média</span><b>{Math.round((extracao.confianca_media ?? 0) * 100)}%</b></div>
          <div className="metrica"><span>Laboratório</span><b style={{ fontSize: 15 }}>{extracao.laboratorio ?? '—'}</b></div>
          <div className="metrica"><span>Protocolo</span><b style={{ fontSize: 15 }}>{ident.protocolo ?? '—'}</b></div>
          <div className="metrica"><span>Amostra</span><b style={{ fontSize: 15 }}>{ident.amostra ?? '—'}</b></div>
        </Grade>
      )}

      <div className="grade g2" style={{ alignItems: 'start' }}>
        <Cartao olho="Laudo original" titulo="PDF enviado">
          {urlPdf ? (
            <iframe src={urlPdf} title="Laudo em PDF" style={{ width: '100%', height: 640, border: '1px solid var(--linha)', borderRadius: 8 }} />
          ) : (
            <p className="nota">Não foi possível carregar o PDF.</p>
          )}
        </Cartao>

        <form action={confirmarLaudo}>
          <input type="hidden" name="documento_id" value={id} />
          <Cartao olho="Cadastro assistido" titulo="A quem pertence esta amostra">
            <div className="campo">
              <label htmlFor="talhao_id">
                Talhão {ident.produtor ? <span className="un">laudo diz: &ldquo;{ident.produtor}&rdquo;</span> : null}
              </label>
              <select id="talhao_id" name="talhao_id" required defaultValue="">
                <option value="" disabled>selecione…</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome} — {t.produtor}</option>
                ))}
              </select>
            </div>
            {candidatos.length > 0 && (
              <p className="nota" style={{ marginTop: 8 }}>
                {melhorCandidato && melhorCandidato.score >= 0.9
                  ? <>Provável match: <b>{melhorCandidato.nome}</b> ({Math.round(melhorCandidato.score * 100)}% de similaridade) — confirme o talhão dele acima.</>
                  : <>Candidatos por semelhança de nome: {candidatos.map((c) => `${c.nome} (${Math.round(c.score * 100)}%)`).join(', ')}.</>}
              </p>
            )}
            {!ident.produtor && (
              <p className="nota" style={{ marginTop: 8 }}>O laudo não trouxe o nome do cliente — escolha o talhão manualmente.</p>
            )}
          </Cartao>

          <Cartao olho="Coleta" titulo="Dados da amostra">
            <div className="grade g3">
              <div className="campo">
                <label htmlFor="data_coleta">Data da coleta</label>
                <input id="data_coleta" name="data_coleta" type="date" defaultValue={paraDataInput(ident.data)} />
              </div>
              <div className="campo">
                <label htmlFor="profundidade">Profundidade <span className="un">cm</span></label>
                <select id="profundidade" name="profundidade" defaultValue="0-20">
                  <option>0-20</option><option>20-40</option><option>0-40</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="laboratorio">Laboratório</label>
                <input id="laboratorio" name="laboratorio" defaultValue={(doc.laboratorio as string) ?? ''} autoComplete="off" />
              </div>
            </div>
          </Cartao>

          <Cartao olho="Parâmetros extraídos" titulo="Confira campo a campo">
            <div className="grade g4">
              {CAMPOS.map(([chave, rot, un]) => {
                const c = campos[chave];
                const { tom, txt } = tomConfianca(c?.confianca);
                return (
                  <div className="campo" key={chave}>
                    <label htmlFor={chave}>{rot} <span className="un">{un}</span></label>
                    <input className="mono" id={chave} name={chave} inputMode="decimal" autoComplete="off"
                      defaultValue={c?.valor ?? ''} />
                    <div style={{ marginTop: 5 }}><Tag tom={tom}>{txt}</Tag></div>
                  </div>
                );
              })}
            </div>
            <div className="campo" style={{ marginTop: 12, maxWidth: 220 }}>
              <label htmlFor="prnt">PRNT do calcário <span className="un">% (padrão 85)</span></label>
              <input className="mono" id="prnt" name="prnt" inputMode="decimal" autoComplete="off" />
            </div>
          </Cartao>

          {extracao?.avisos?.length ? (
            <div className="aviso" style={{ marginBottom: 14 }}>
              {extracao.avisos.map((a, i) => <div key={i}>{a}</div>)}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn verde" type="submit">Confirmar e interpretar</button>
          </div>
        </form>
      </div>
    </>
  );
}
