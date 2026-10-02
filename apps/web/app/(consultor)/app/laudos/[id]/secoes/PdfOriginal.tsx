import { Cartao } from '@/components/ui';

export function PdfOriginal({ urlPdf }: { urlPdf: string | null }) {
  return (
    <Cartao olho="Laudo original" titulo="PDF enviado">
      {urlPdf ? (
        <>
          {/* no celular o PDF embutido não rola nem dá zoom direito: o botão abre no leitor do aparelho */}
          <a className="btn sec pdf-abrir" href={urlPdf} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 10 }}>Abrir o PDF em tela cheia</a>
          <iframe className="pdf-quadro" src={urlPdf} title="Laudo em PDF" style={{ width: '100%', height: 640, border: '1px solid var(--linha)', borderRadius: 8 }} />
        </>
      ) : (
        <p className="nota">Não foi possível carregar o PDF.</p>
      )}
    </Cartao>
  );
}
