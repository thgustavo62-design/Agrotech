import { Cartao } from '@/components/ui';
import type { Candidato, TalhaoOpcao } from '../dados';

/** A quem pertence a amostra: talhão + sugestões de produtor por semelhança de nome. */
export function CadastroAssistido({
  produtorNoLaudo, talhoes, candidatos,
}: {
  produtorNoLaudo: string | null | undefined;
  talhoes: TalhaoOpcao[];
  candidatos: Candidato[];
}) {
  const melhorCandidato = candidatos[0];
  return (
    <Cartao olho="Cadastro assistido" titulo="A quem pertence esta amostra">
      <div className="campo">
        <label htmlFor="talhao_id">
          Talhão {produtorNoLaudo ? <span className="un">laudo diz: &ldquo;{produtorNoLaudo}&rdquo;</span> : null}
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
      {!produtorNoLaudo && (
        <p className="nota" style={{ marginTop: 8 }}>O laudo não trouxe o nome do cliente — escolha o talhão manualmente.</p>
      )}
    </Cartao>
  );
}
