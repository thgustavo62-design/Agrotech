/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // o motor é TS puro no monorepo — deixa o Next transpilar direto do source
  transpilePackages: ['@agrotech/agro-core'],
};

export default nextConfig;
