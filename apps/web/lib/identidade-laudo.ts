/**
 * Identidade que assina o laudo: o ESCRITÓRIO do responsável (não um nome fixo da plataforma) e o profissional com
 * CREA. Sem nome e CREA o laudo não sai — quem lê (produtor, fiscalização) precisa saber quem responde por ele.
 * Função pura para testar; a ação de emissão busca os dados e chama aqui.
 */

export interface DadosResponsavel { nome?: string | null; crea?: string | null; fone?: string | null }
export interface DadosEscritorio { nome?: string | null; municipio?: string | null; uf?: string | null }

export interface ConsultorDoLaudo { nome: string; crea: string; fone: string; empresa: string }

const limpa = (v: string | null | undefined) => (v ?? '').trim();

export function identidadeDoLaudo(
  resp: DadosResponsavel,
  org: DadosEscritorio,
): { ok: true; consultor: ConsultorDoLaudo } | { ok: false; mensagem: string } {
  const nome = limpa(resp.nome);
  const crea = limpa(resp.crea);
  const empresa = limpa(org.nome);

  const faltam: string[] = [];
  if (!nome) faltam.push('seu nome');
  if (!crea) faltam.push('o CREA');
  if (faltam.length) {
    return { ok: false, mensagem: `Não é possível emitir o laudo: informe ${faltam.join(' e ')} em Configurações → Meu perfil. O laudo leva o nome e o CREA de quem responde por ele.` };
  }
  if (!empresa) {
    return { ok: false, mensagem: 'Não é possível emitir o laudo: informe o nome do escritório em Configurações → Escritório.' };
  }
  const local = [limpa(org.municipio), limpa(org.uf).toUpperCase()].filter(Boolean).join('/');
  return { ok: true, consultor: { nome, crea, fone: limpa(resp.fone), empresa: local ? `${empresa} · ${local}` : empresa } };
}
