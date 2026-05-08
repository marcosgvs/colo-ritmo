import { describe, expect, test } from 'vitest';
import { haversine, multiplicadorTransito } from './geo';

describe('haversine', () => {
  test('mesmo ponto = 0', () => {
    const p = { lat: -15.793, lng: -47.882 };
    expect(haversine(p, p)).toBeCloseTo(0, 5);
  });

  test('Brasília (Praça dos Três Poderes) → São Paulo (Sé) ~870 km', () => {
    const brasilia = { lat: -15.799, lng: -47.864 };
    const sp = { lat: -23.5505, lng: -46.6333 };
    const km = haversine(brasilia, sp);
    expect(km).toBeGreaterThan(850);
    expect(km).toBeLessThan(900);
  });

  test('HSL-Brasília → HBDF-Brasília ~3-5 km', () => {
    const hsl = { lat: -15.831, lng: -47.926 };
    const hbdf = { lat: -15.804, lng: -47.901 };
    const km = haversine(hsl, hbdf);
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(6);
  });

  test('simétrica · a→b == b→a', () => {
    const a = { lat: -15.799, lng: -47.864 };
    const b = { lat: -15.831, lng: -47.926 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });
});

describe('multiplicadorTransito', () => {
  test('pico manhã 7-9', () => {
    expect(multiplicadorTransito(7)).toBe(1.5);
    expect(multiplicadorTransito(8)).toBe(1.5);
    expect(multiplicadorTransito(8.99)).toBe(1.5);
  });

  test('pico tarde 17-20', () => {
    expect(multiplicadorTransito(17)).toBe(1.5);
    expect(multiplicadorTransito(18.5)).toBe(1.5);
    expect(multiplicadorTransito(19.99)).toBe(1.5);
  });

  test('madrugada 0-6', () => {
    expect(multiplicadorTransito(0)).toBe(0.7);
    expect(multiplicadorTransito(3)).toBe(0.7);
    expect(multiplicadorTransito(5.99)).toBe(0.7);
  });

  test('horários neutros', () => {
    expect(multiplicadorTransito(10)).toBe(1.0);
    expect(multiplicadorTransito(14)).toBe(1.0);
    expect(multiplicadorTransito(22)).toBe(1.0);
  });

  test('hora ≥ 24 normaliza', () => {
    expect(multiplicadorTransito(31)).toBe(multiplicadorTransito(7));
  });
});
