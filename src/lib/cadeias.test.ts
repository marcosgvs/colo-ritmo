import { describe, expect, test } from 'vitest';
import type { Bloco } from '@/types';
import { calcCadeias } from './cadeias';

function plantao(id: number, data: string, hora: number, dur: number): Bloco {
  return {
    id,
    tipo: 'plantao',
    hospitalId: 'HBDF',
    data,
    horaInicio: hora,
    duracao: dur,
    setor: 'UTI',
  };
}

function sono(id: number, data: string, hora: number, dur: number): Bloco {
  return { id, tipo: 'sono', data, horaInicio: hora, duracao: dur };
}

function bloqueio(id: number, data: string): Bloco {
  return { id, tipo: 'bloqueio', data, horaInicio: 0, duracao: 24 };
}

describe('calcCadeias', () => {
  test('vazio retorna vazio', () => {
    expect(calcCadeias([])).toEqual([]);
  });

  test('um bloco sozinho vira uma cadeia de 1', () => {
    const blocos = [plantao(1, '2026-05-04', 7, 12)];
    const c = calcCadeias(blocos);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocos).toHaveLength(1);
    expect(c[0]!.totalH).toBe(12);
  });

  test('plantão + sono colado entram na mesma cadeia', () => {
    const blocos = [
      plantao(1, '2026-05-04', 7, 12),
      sono(2, '2026-05-04', 19, 8), // colado
    ];
    const c = calcCadeias(blocos);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocos).toHaveLength(2);
    expect(c[0]!.totalH).toBe(20);
  });

  test('gap maior que 0.6h quebra cadeia', () => {
    const blocos = [
      plantao(1, '2026-05-04', 7, 6), // termina 13h
      plantao(2, '2026-05-04', 19, 12), // começa 19h, gap = 6h
    ];
    const c = calcCadeias(blocos);
    expect(c).toHaveLength(2);
  });

  test('gap pequeno (deslocamento de 30min) cola a cadeia', () => {
    const blocos = [
      plantao(1, '2026-05-04', 7, 6), // termina 13h
      plantao(2, '2026-05-04', 13.5, 6), // 30min depois
    ];
    const c = calcCadeias(blocos);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocos).toHaveLength(2);
  });

  test('plantão noturno cruza meia-noite — fim no dia seguinte', () => {
    const blocos = [plantao(1, '2026-05-04', 19, 12)];
    const c = calcCadeias(blocos);
    expect(c[0]!.fim).toEqual({ data: '2026-05-05', hora: 7 });
    expect(c[0]!.totalH).toBe(12);
  });

  test('bloqueio é ignorado', () => {
    const blocos = [
      plantao(1, '2026-05-04', 7, 6),
      bloqueio(2, '2026-05-04'),
      plantao(3, '2026-05-05', 7, 6),
    ];
    const c = calcCadeias(blocos);
    // 2 cadeias separadas (um por dia) — bloqueio não conecta
    expect(c).toHaveLength(2);
  });

  test('blocos fora de ordem são re-ordenados', () => {
    const blocos = [
      plantao(2, '2026-05-04', 19, 12),
      plantao(1, '2026-05-04', 7, 6),
    ];
    const c = calcCadeias(blocos);
    expect(c[0]!.blocos[0]!.id).toBe(1);
  });
});
