import nextVitals from 'eslint-config-next/core-web-vitals';

/**
 * `next lint` saiu no Next 16: o ESLint roda direto (config plana), com as mesmas regras de antes
 * (core-web-vitals). O plugin novo traz regras do React Compiler; esta, em particular, desligada de propósito:
 * ler algo que só existe no navegador (localStorage, âncora da URL, estado da rede) DEPOIS da hidratação — para
 * não divergir do HTML do servidor — é exatamente o que os efeitos daqui fazem.
 */
const config = [
  ...nextVitals,
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
  { ignores: ['.next/**', 'node_modules/**', 'e2e/**', 'next-env.d.ts'] },
];

export default config;
