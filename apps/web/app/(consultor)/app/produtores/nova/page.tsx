import { CabecalhoVista } from '@/components/ui';
import { FormProdutor } from '@/components/form-produtor';

export default function NovoProdutor() {
  return (
    <>
      <CabecalhoVista olho="Carteira" titulo="Novo produtor" descricao="O produtor é a raiz — propriedades, talhões, análises e visitas ficam ligados a ele." />
      <FormProdutor />
    </>
  );
}
