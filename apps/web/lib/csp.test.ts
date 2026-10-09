import { describe, expect, it } from 'vitest';
import { montarCsp, novoNonce } from './csp';

const diretiva = (csp: string, nome: string) => csp.split('; ').find((d) => d.startsWith(`${nome} `)) ?? '';

describe('montarCsp', () => {
  const csp = montarCsp({ nonce: 'abc123', supabaseUrl: 'https://xyz.supabase.co/' });

  it('script só com nonce, sem inline nem eval em produção', () => {
    const s = diretiva(csp, 'script-src');
    expect(s).toContain("'nonce-abc123'");
    expect(s).toContain("'strict-dynamic'");
    expect(s).not.toContain("'unsafe-inline'");
    expect(s).not.toContain("'unsafe-eval'");
  });

  it('só fala com o próprio site e com o Supabase configurado', () => {
    expect(diretiva(csp, 'connect-src')).toBe("connect-src 'self' https://xyz.supabase.co wss://xyz.supabase.co");
    expect(diretiva(csp, 'img-src')).toContain('https://xyz.supabase.co');
    expect(diretiva(csp, 'img-src')).toContain('https://*.tile.openstreetmap.org');
  });

  it('ninguém embute o app, sem plugin, base e formulário só no próprio site', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('iframe só dos dois players de vídeo da Academy (nada de coringa nem do próprio site)', () => {
    expect(diretiva(csp, 'frame-src')).toBe('frame-src https://www.youtube-nocookie.com https://player.vimeo.com');
    expect(diretiva(csp, 'frame-src')).not.toContain('*');
    expect(diretiva(csp, 'frame-src')).not.toContain("'self'");
  });

  it('desenvolvimento libera eval e websocket local, sem forçar https', () => {
    const dev = montarCsp({ nonce: 'n', supabaseUrl: 'http://127.0.0.1:54321', desenvolvimento: true });
    expect(diretiva(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(diretiva(dev, 'connect-src')).toContain('http://127.0.0.1:54321');
  });

  it('sem Supabase configurado não inventa origem', () => {
    expect(diretiva(montarCsp({ nonce: 'n' }), 'connect-src')).toBe("connect-src 'self'");
    expect(diretiva(montarCsp({ nonce: 'n', supabaseUrl: 'lixo' }), 'connect-src')).toBe("connect-src 'self'");
  });
});

describe('novoNonce', () => {
  it('é base64 de 16 bytes e muda a cada chamada', () => {
    const a = novoNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(novoNonce()).not.toBe(a);
  });
});
