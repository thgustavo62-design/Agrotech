import Link from 'next/link';

export default function Cadastro() {
  return (
    <div className="tela-login">
      <div className="marca">AgroTech <span>Assistência técnica</span></div>
      <p>
        O cadastro de escritório (cria a organização e semeia as tabelas de referência a partir de
        <code> clonarPadrao()</code>) entra ainda na Fase 1.
      </p>
      <p style={{ fontSize: 13 }}>
        Por enquanto: <Link href="/demo">abrir a vitrine</Link> ou <Link href="/login">entrar</Link>.
      </p>
    </div>
  );
}
