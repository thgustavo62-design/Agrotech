# LGPD — minuta de trabalho (AG-017)

> **RASCUNHO técnico, não é aconselhamento jurídico.** Foi escrito a partir do que o sistema **realmente faz hoje** para que um advogado revise, complete e valide. Nada aqui foi publicado no site. Tudo marcado com **[ADVOGADO]** precisa de decisão ou redação jurídica; **[DONO]** precisa de uma decisão sua.
> Última atualização: 08/10/2026.

## 1. Papéis (quem é quem na LGPD) — [ADVOGADO] confirmar
| Papel | Quem | Porquê (hipótese a validar) |
|---|---|---|
| **Controlador** dos dados dos produtores | O **escritório de assistência técnica** (cliente do AgroTech) | É ele quem decide coletar e usar os dados dos seus clientes produtores |
| **Operador** | O **AgroTech** (a plataforma) | Trata os dados em nome do escritório, seguindo as instruções dele |
| **Controlador** dos dados de conta da equipe do escritório | Possivelmente o AgroTech (contas, login, cobrança) | Para fins próprios de operar o serviço |
| **Suboperadores** | Supabase (banco, login, arquivos), Vercel (hospedagem), GitHub (código e backups criptografados), Asaas (cobrança, quando ativa), Resend (e-mail, se ativado) | Servidores no exterior (Supabase: Oregon/EUA; Vercel/GitHub: EUA) → **transferência internacional [ADVOGADO]** |

## 2. Mapa de dados (o que existe, onde, por quê)
| Dado | Titular | Onde fica | Finalidade | Base legal sugerida [ADVOGADO] |
|---|---|---|---|---|
| Nome, e-mail, telefone, CPF/CNPJ (opcional) do produtor | Produtor | `agro.produtores` | Cadastro e contato | Execução de contrato / legítimo interesse do escritório |
| Propriedade (nome, município, UF, CAR, coordenadas), talhões (área, cultura, contorno) | Produtor | `agro.propriedades`, `agro.talhoes` | Recomendação técnica | Execução de contrato |
| Resultados de análise de solo, recomendações e laudos (PDF) | Produtor | `agro.analises`, `agro.recomendacoes`, Storage `laudos`/`recomendacoes` | Serviço técnico | Execução de contrato; obrigação regulatória (responsabilidade técnica) |
| Visitas: observações, ocorrências, **fotos com localização** | Produtor | `agro.visitas`, `agro.visita_fotos`, Storage `visitas` | Acompanhamento de campo | Execução de contrato |
| Financeiro do produtor (receitas, despesas) | Produtor | `agro.financeiro_*` | Gestão do próprio produtor (o escritório **não** vê) | Consentimento / execução de contrato |
| Nome, e-mail, CREA, ART, telefone, cargo, perfis de acesso | Equipe do escritório | `auth.users`, `agro.profiles` | Autenticação e assinatura de laudos | Execução de contrato; obrigação regulatória (CREA) |
| Senha (somente o **hash**), fator de segundo passo | Equipe | `auth.users`, `auth.mfa_factors` (Supabase) | Segurança do acesso | Legítimo interesse (segurança) |
| Registro de atividade (quem fez o quê, quando) | Equipe e produtores | `agro.audit_log` | Segurança, rastreabilidade (LGPD art. 37) | Legítimo interesse / obrigação |
| Dados de cobrança do escritório | Titular da conta | Asaas (a plataforma guarda só ids e status) | Cobrança | Execução de contrato |
| Backup diário (criptografado) | Todos acima | Artefato privado do GitHub, 30 dias | Recuperação de desastre | Legítimo interesse (segurança/continuidade) |

**Dados sensíveis (art. 5º, II):** o sistema **não** pede saúde, biometria, origem racial, religião etc. **Localização da propriedade e fotos** são dados pessoais (identificam o produtor), não sensíveis. **[ADVOGADO]** confirmar.
**Menores de idade:** o sistema não foi desenhado para isso e não os identifica.

## 3. Direitos dos titulares (art. 18) e como o sistema atende hoje
| Direito | Como atender hoje | Falta |
|---|---|---|
| Confirmação e acesso | Escritório: na ficha do produtor → **Exportar dados** (JSON) | Exportar em formato legível (PDF/CSV) além do JSON; exportar dados da **equipe** |
| Correção | Edição do cadastro pelo escritório | — |
| Eliminação | Escritório: ficha do produtor → **Zona de risco → Excluir** (apaga em cascata; a conta de login do produtor é removida pela service role) | Teste com a chave de serviço em produção (pendente do dono); definir prazo de resposta |
| Portabilidade | Mesma exportação JSON | Documentar o formato |
| Informação sobre compartilhamento | Lista de suboperadores (seção 1) | Publicar na política |
| Revogação do consentimento | Excluir ou desativar | Fluxo de pedido do titular (hoje é por contato com o escritório) |
| Titular da equipe | Remover conta = bloqueio + desvinculação; histórico preservado por segurança | **[ADVOGADO]** prazo e critério de anonimização do histórico |

## 4. Retenção — proposta [DONO] + [ADVOGADO]
| Dado | Proposta | Hoje |
|---|---|---|
| Dados do produtor e da carteira | Enquanto o contrato com o escritório durar + prazo legal de guarda do laudo técnico **[ADVOGADO: prazo CONFEA/CREA]** | Sem exclusão automática |
| Laudos e recomendações emitidos | Guardar (valor probatório da responsabilidade técnica); anonimizar o produtor só se ele pedir **e** o prazo legal permitir | Imutáveis |
| Registro de atividade | 5 anos | Sem limpeza automática |
| Backups | 30 dias (artefato do GitHub) | Cumprido pelo workflow |
| Conta removida da equipe | Conta bloqueada, e-mail liberado, dados de autoria preservados | Implementado (migração 0039) |
| Fotos e PDFs | Junto com o produtor | **Corrigido em 08/10/2026:** a exclusão do produtor agora apaga também os PDFs e fotos do Storage (antes ficavam órfãos). Precisa da chave de serviço no servidor; se faltar, o aviso diz o que ficou pendente |

> Verificado: a exclusão do produtor apagava só as linhas do banco; os arquivos ficavam no Storage. Corrigido (ver acima). Arquivos de laudos sem produtor associado (pasta `_`) continuam fora dessa limpeza.

## 5. Segurança — o que já existe (para a cláusula de medidas técnicas)
Isolamento por escritório e por produtor aplicado no banco (RLS), com testes automatizados; perfis de acesso por função; senha com regras e troca obrigatória da provisória; verificação em duas etapas opcional (aplicada no banco); CSP e cabeçalhos de segurança; sessões e remoção de acesso imediata; trilha de auditoria; backup diário **criptografado** com ensaio de restauração; atualização de dependências e `npm audit` limpo; Edge Functions com autorização explícita.
**Limites a declarar com honestidade:** sem verificação de e-mail no cadastro; sem proteção contra senhas vazadas (plano gratuito do Supabase); sem pentest independente; arquivos do Storage fora do backup.

## 6. Incidente de segurança — plano de resposta (art. 48)
1. **Conter (primeiras horas):** remover/bloquear as contas envolvidas (Equipe e permissões), trocar senhas, revogar chaves expostas (Supabase → API Keys; Vercel → variáveis; GitHub → secrets) e **redeploy**.
2. **Registrar:** o que aconteceu, quando, quais dados e quantos titulares, como foi descoberto. Guardar logs (Vercel/Supabase) e o histórico da equipe.
3. **Avaliar o risco:** há risco ou dano relevante aos titulares? **[ADVOGADO]** decide.
4. **Comunicar:** à ANPD e aos titulares em prazo razoável (a ANPD indica 3 dias úteis como referência) quando houver risco relevante; os **escritórios (controladores)** devem ser avisados primeiro, pois o AgroTech é o operador. Modelo de aviso: **[ADVOGADO]**.
5. **Corrigir e aprender:** corrigir a causa, registrar em `docs/PROGRESSO.md`, criar teste de regressão.

## 7. O que um advogado precisa produzir/validar
1. **Política de privacidade** definitiva (a atual em `/privacidade` é um texto inicial curto, de setembro/2026).
2. **Termos de uso** (hoje `/termos`, também inicial; cita o nome "Campo Forte Soluções Agrícolas" — ver abaixo).
3. **Contrato de prestação do serviço** com cláusula de **operador** (Anexo de tratamento de dados): objeto, instruções, suboperadores, transferência internacional, segurança, auditoria, devolução/eliminação ao fim, incidente.
4. **Papéis** (seção 1), **bases legais** (seção 2) e **retenção** (seção 4).
5. **Encarregado (DPO):** quem será e como o titular o contata.
6. **Aviso de cookies/armazenamento local:** o app usa cookies de sessão e armazenamento local para a fila offline; sem rastreamento publicitário.

## 8. Ajustes técnicos que isto revela (para eu fazer, se você autorizar) — [DONO]
- [ ] Texto das páginas `/privacidade` e `/termos`: trocar o nome fixo "Campo Forte" pelo da empresa que opera a plataforma e incluir a lista de suboperadores — **só depois do texto jurídico aprovado**.
- [x] Exclusão do produtor apagar também os arquivos do Storage — feito em 08/10/2026.
- [ ] Exportação de dados da equipe e em formato legível.
- [ ] Limpeza automática do registro de atividade além do prazo definido.
