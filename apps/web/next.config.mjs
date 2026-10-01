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

export default nextConfig;
