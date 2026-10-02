import { EsqueletoPagina } from '@/components/esqueleto';

/** Mostrado imediatamente ao navegar entre telas do portal do produtor. */
export default function Carregando() {
  return <EsqueletoPagina indicadores={2} linhas={3} />;
}
