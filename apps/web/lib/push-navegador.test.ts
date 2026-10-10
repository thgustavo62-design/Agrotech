import { describe, expect, it } from 'vitest';
import { bytesParaChave, chaveParaBytes, situacaoDosAvisos } from './push-navegador';

describe('chave em base64 url ↔ bytes', () => {
  it('ida e volta sem perder nada (inclusive com - e _)', () => {
    const original = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
    const bytes = chaveParaBytes(original);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4); // ponto não comprimido
    expect(bytesParaChave(bytes.buffer as ArrayBuffer)).toBe(original);
  });
  it('sem buffer devolve vazio', () => {
    expect(bytesParaChave(null)).toBe('');
  });
});

describe('situação dos avisos', () => {
  const base = { temServiceWorker: true, temPush: true, temNotificacao: true, permissao: 'default', assinado: false, ehIos: false, instalado: false };
  it('desligado, ligado e bloqueado', () => {
    expect(situacaoDosAvisos(base)).toBe('desligado');
    expect(situacaoDosAvisos({ ...base, permissao: 'granted', assinado: true })).toBe('ligado');
    expect(situacaoDosAvisos({ ...base, permissao: 'granted', assinado: false })).toBe('desligado');
    expect(situacaoDosAvisos({ ...base, permissao: 'denied' })).toBe('bloqueado');
  });
  it('sem suporte no navegador', () => {
    expect(situacaoDosAvisos({ ...base, temPush: false })).toBe('sem-suporte');
    expect(situacaoDosAvisos({ ...base, temServiceWorker: false })).toBe('sem-suporte');
  });
  it('no iPhone só com o app instalado', () => {
    expect(situacaoDosAvisos({ ...base, ehIos: true, instalado: false, temPush: false })).toBe('precisa-instalar');
    expect(situacaoDosAvisos({ ...base, ehIos: true, instalado: true })).toBe('desligado');
  });
});
