/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // o motor é TS puro no monorepo — deixa o Next transpilar direto do source
  transpilePackages: ['@agrotech/agro-core'],
  // OCR de laudo escaneado: binário nativo e WASM não podem ser empacotados pelo Next
  serverExternalPackages: ['@napi-rs/canvas', 'tesseract.js', 'unpdf'],
  // visita com até 6 fotos já reduzidas no navegador (~0,3–0,8 MB cada); o padrão de 1 MB não cabe
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

/**
 * Cabeçalhos de segurança estáticos. A Content-Security-Policy NÃO fica aqui: ela leva um nonce novo por
 * requisição e é montada no middleware (lib/csp.ts).
 */
const cabecalhos = [
  { key: 'X-Frame-Options', value: 'DENY' }, // ninguém embute o app em iframe (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // geolocalização é usada no caderno de campo; o resto do hardware não
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

nextConfig.headers = async () => [{ source: '/:path*', headers: cabecalhos }];

export default nextConfig;
