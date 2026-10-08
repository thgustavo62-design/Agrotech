import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { iguaisEmTempoConstante, tokenBearer, ehUuid, ehEmail, segredoConfere } from '../../../supabase/functions/_shared/seguranca';

const FUNCOES = new URL('../../../supabase/functions/', import.meta.url);

describe('seguranca.ts (usado por todas as Edge Functions)', () => {
  it('compara segredos em tempo constante e sem falso positivo', () => {
    expect(iguaisEmTempoConstante('abc123', 'abc123')).toBe(true);
    expect(iguaisEmTempoConstante('abc123', 'abc124')).toBe(false);
    expect(iguaisEmTempoConstante('abc', 'abc123')).toBe(false);
    expect(iguaisEmTempoConstante('', '')).toBe(true); // por isso segredoConfere exige segredo configurado
  });

  it('segredo ausente, curto ou vazio NUNCA autoriza (nem vazio com vazio)', () => {
    expect(segredoConfere('', '')).toBe(false);
    expect(segredoConfere(null, undefined)).toBe(false);
    expect(segredoConfere('curto', 'curto')).toBe(false);
    expect(segredoConfere('', 'um-segredo-bem-comprido-123')).toBe(false);
    expect(segredoConfere('um-segredo-bem-comprido-123', 'um-segredo-bem-comprido-123')).toBe(true);
    expect(segredoConfere('um-segredo-bem-comprido-124', 'um-segredo-bem-comprido-123')).toBe(false);
  });

  it('lê o token Bearer e recusa o resto', () => {
    expect(tokenBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(tokenBearer('bearer abc')).toBe('abc');
    expect(tokenBearer('Basic abc')).toBeNull();
    expect(tokenBearer('Bearer')).toBeNull();
    expect(tokenBearer(null)).toBeNull();
  });

  it('valida uuid e e-mail', () => {
    expect(ehUuid('a0000000-0000-0000-0000-000000000000')).toBe(true);
    expect(ehUuid("x' or 1=1 --")).toBe(false);
    expect(ehUuid(undefined)).toBe(false);
    expect(ehEmail('a@b.co')).toBe(true);
    expect(ehEmail('a b@c.com')).toBe(false);
    expect(ehEmail('a'.repeat(250) + '@b.com')).toBe(false);
  });
});

/**
 * Guarda estrutural: toda função que usa a service_role e atende chamadas de gente precisa autorizar ANTES de
 * tocar no banco. Não substitui o teste com um Supabase real (não rodado), mas impede o erro óbvio de voltar.
 */
describe('Edge Functions — nenhuma abre a service_role sem autorizar', () => {
  const pastas = readdirSync(FUNCOES, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);

  it('sintaxe válida em todas', () => {
    for (const nome of [...pastas.map((p) => `${p}/index.ts`), '_shared/autorizacao.ts', '_shared/seguranca.ts']) {
      const fonte = readFileSync(new URL(nome, FUNCOES), 'utf8');
      const r = ts.transpileModule(fonte, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } });
      expect(r.diagnostics?.map((d) => String(d.messageText)), nome).toEqual([]);
    }
  });

  const USUARIO = ['processar-laudo', 'gerar-laudo-pdf', 'convidar-produtor'];
  for (const nome of USUARIO) {
    it(`${nome}: autentica quem chama e confere o escritório antes de usar a service_role`, () => {
      const f = readFileSync(new URL(`${nome}/index.ts`, FUNCOES), 'utf8');
      expect(f).toMatch(/identificar\(req\)/);
      expect(f).toMatch(/equipeAutorizada\(/);
      // o cliente de serviço só é criado pela função compartilhada, nunca com a chave direto
      expect(f).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      // e a autorização vem antes do primeiro acesso a dados
      const aut = f.search(/identificar\(req\)/);
      const dados = f.search(/\.from\('(documentos|recomendacoes|produtores)'\)/);
      expect(aut, 'autoriza antes de ler').toBeLessThan(dados);
    });
  }

  it('processar-laudo só aceita segredo interno configurado ou usuário da equipe', () => {
    const f = readFileSync(new URL('processar-laudo/index.ts', FUNCOES), 'utf8');
    expect(f).toMatch(/segredoConfere\(/);
    expect(f).toMatch(/REPROCESSAVEIS/);
  });

  it('webhook-asaas confere o token do gateway em tempo constante', () => {
    const f = readFileSync(new URL('webhook-asaas/index.ts', FUNCOES), 'utf8');
    expect(f).toMatch(/iguaisEmTempoConstante\(/);
    expect(f).toMatch(/!tokenEsperado/);
  });
});
