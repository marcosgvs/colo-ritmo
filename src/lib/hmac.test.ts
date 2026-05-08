import { describe, expect, test } from 'vitest';
import {
  gerarPreviewLink,
  hmacAssinar,
  hmacVerificar,
  verificarPreviewLink,
} from './hmac';

const SECRET = 'test-secret-pra-hmac-32-bytes-min-aaaaaaaa';

describe('hmacAssinar / hmacVerificar', () => {
  test('roundtrip', async () => {
    const sig = await hmacAssinar(SECRET, 'medica:123');
    expect(await hmacVerificar(SECRET, 'medica:123', sig)).toBe(true);
  });

  test('payload diferente falha', async () => {
    const sig = await hmacAssinar(SECRET, 'medica:123');
    expect(await hmacVerificar(SECRET, 'parceiro:123', sig)).toBe(false);
  });

  test('secret diferente falha', async () => {
    const sig = await hmacAssinar(SECRET, 'medica:123');
    expect(await hmacVerificar('outro-secret', 'medica:123', sig)).toBe(false);
  });

  test('sig curta falha (sem timing leak)', async () => {
    expect(await hmacVerificar(SECRET, 'medica:123', 'abc')).toBe(false);
  });
});

describe('gerarPreviewLink / verificarPreviewLink', () => {
  test('roundtrip aceita link recém-criado', async () => {
    const link = await gerarPreviewLink(SECRET, 'https://example.com', 'parceiro', 60_000);
    const u = new URL(link);
    const claim = await verificarPreviewLink(SECRET, {
      as: u.searchParams.get('as') ?? '',
      exp: u.searchParams.get('exp') ?? '',
      sig: u.searchParams.get('sig') ?? '',
    });
    expect(claim?.as).toBe('parceiro');
    expect(claim?.exp).toBeGreaterThan(Date.now());
  });

  test('expirado retorna null', async () => {
    const expPassado = Date.now() - 10_000;
    const sig = await hmacAssinar(SECRET, `parceiro:${expPassado}`);
    const claim = await verificarPreviewLink(SECRET, {
      as: 'parceiro',
      exp: String(expPassado),
      sig,
    });
    expect(claim).toBeNull();
  });

  test('as inválido retorna null', async () => {
    const claim = await verificarPreviewLink(SECRET, {
      as: 'coordenadora',
      exp: String(Date.now() + 60_000),
      sig: 'qualquer',
    });
    expect(claim).toBeNull();
  });

  test('sig inválida retorna null', async () => {
    const claim = await verificarPreviewLink(SECRET, {
      as: 'medica',
      exp: String(Date.now() + 60_000),
      sig: 'a'.repeat(64),
    });
    expect(claim).toBeNull();
  });

  test('faltando params retorna null', async () => {
    expect(await verificarPreviewLink(SECRET, {})).toBeNull();
    expect(await verificarPreviewLink(SECRET, { as: 'medica' })).toBeNull();
  });
});
