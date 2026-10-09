import { exigirConta } from '@/lib/guarda-de-site';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AgroTech Connect' };

export default async function LayoutConnect({ children }: { children: React.ReactNode }) {
  const { bloqueio } = await exigirConta('connect');
  if (bloqueio) return bloqueio;
  return <div className="site-connect">{children}</div>;
}
