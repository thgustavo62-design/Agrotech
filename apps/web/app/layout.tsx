import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { RegistrarSW } from '@/components/registrar-sw';
import { AvisoFlash } from '@/components/aviso-flash';
import './globals.css';
import './mobile.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
  variable: '--fonte-archivo',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fonte-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AgroTech',
  description: 'Assistência técnica agronômica — Campo Forte',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AgroTech',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f5c43',
  width: 'device-width',
  initialScale: 1,
  // ocupa a tela toda no iPhone com notch; as áreas seguras (env(safe-area-inset-*)) são tratadas no CSS
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <RegistrarSW />
        <AvisoFlash />
        {children}
      </body>
    </html>
  );
}
