import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LIMITE_MS = 4000;

async function sonda(url: string, cabecalhos: Record<string, string> = {}): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-store' });
    return { ok: r.ok, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

/**
 * Saúde do sistema para monitoramento externo (o workflow "Monitoramento" e qualquer serviço de uptime).
 * Pública de propósito e SEM dados: só diz se o site, o Auth e a API do banco respondem, e a versão no ar.
 * 200 = tudo certo; 503 = algo fora (o corpo diz o quê).
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

  if (!base || !chave) {
    return NextResponse.json({ ok: false, versao, motivo: 'Supabase não configurado' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  const [auth, api] = await Promise.all([
    sonda(`${base}/auth/v1/health`, { apikey: chave }),
    sonda(`${base}/rest/v1/`, { apikey: chave, authorization: `Bearer ${chave}` }),
  ]);
  const ok = auth.ok && api.ok;
  return NextResponse.json(
    { ok, versao, auth, api },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
