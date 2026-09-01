import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgroTech',
  description: 'Assistência técnica agronômica — Campo Forte',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
