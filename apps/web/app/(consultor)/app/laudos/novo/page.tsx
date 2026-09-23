import Link from 'next/link';
import { CabecalhoVista, Cartao } from '@/components/ui';
import { enviarLaudo } from './acoes';

export default function NovoLaudo() {
  return (
    <>
      <CabecalhoVista
        olho="Ingestão"
        titulo="Enviar laudo em PDF"
        descricao="O sistema extrai os parâmetros do laudo e devolve para conferência — nada vira análise sem você confirmar."
      />
      <Cartao>
        <form action={enviarLaudo}>
          <div className="campo">
            <label htmlFor="arquivo">Arquivo PDF</label>
            <input id="arquivo" name="arquivo" type="file" accept="application/pdf" required />
          </div>
          <p className="nota" style={{ margin: '10px 0 0' }}>
            Laudo já enviado antes (mesmo arquivo) não é reprocessado — o app te leva direto para a
            conferência existente.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn verde" type="submit">Enviar e extrair</button>
            <Link className="btn sec" href="/app/laudos">Cancelar</Link>
          </div>
        </form>
      </Cartao>
    </>
  );
}
