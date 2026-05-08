import { describe, expect, test } from 'vitest';
import type { Bloco, HospitaisMap, Preferencias } from '@/types';
import { sugerirPlantoes } from './solver.js';

const HOSPITAIS: HospitaisMap = {
  HBDF: {
    id: 'HBDF',
    nome: 'HBDF',
    abrev: 'HBDF',
    cor: 'blue',
    tipo: 'publico',
    valorPlantao: 1800,
    valorFixo: 1800,
    adicionalNoite: 250,
    setores: ['UTI'],
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 0,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: [],
      maxPorMes: 6,
    },
  },
  HSL: {
    id: 'HSL',
    nome: 'HSL',
    abrev: 'HSL',
    cor: 'sand',
    tipo: 'privado',
    valorPlantao: 1800,
    valorHora: 150,
    adicionalNoite: 200,
    setores: ['enf'],
    regras: {
      maxPorSemana: 1,
      minFimDeSemana: 0,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: [],
      maxPorMes: 4,
    },
  },
};

const PREFS: Preferencias = {
  nome: 'Test',
  metaMensal: 12000,
  diasPreferidos: ['ter', 'qua', 'qui'],
  diasEvitar: ['dom'],
  hospitaisPreferidos: ['HBDF', 'HSL'],
  evitar24hCorrido: true,
  maxPlantoesPorSemana: 3,
  janelaPreferida: 'dia',
};

describe('sugerirPlantoes', () => {
  test('mês vazio gera sugestões respeitando max por mês', () => {
    const r = sugerirPlantoes({ blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05' });
    expect(r.blocos.length).toBeGreaterThan(0);
    const porHosp = r.blocos.reduce<Record<string, number>>((acc, b) => {
      acc[b.hospitalId] = (acc[b.hospitalId] ?? 0) + 1;
      return acc;
    }, {});
    expect(porHosp.HBDF ?? 0).toBeLessThanOrEqual(6);
    expect(porHosp.HSL ?? 0).toBeLessThanOrEqual(4);
  });

  test('respeita dias evitados (dom)', () => {
    const r = sugerirPlantoes({ blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05' });
    for (const b of r.blocos) {
      const dia = new Date(b.data + 'T12:00:00').getDay();
      expect(dia).not.toBe(0); // dom
    }
  });

  test('não duplica em dia já ocupado', () => {
    const existente: Bloco = {
      id: 'x',
      tipo: 'plantao',
      hospitalId: 'HBDF',
      data: '2026-05-04',
      horaInicio: 7,
      duracao: 12,
      setor: 'UTI',
    };
    const r = sugerirPlantoes({
      blocos: [existente],
      hospitais: HOSPITAIS,
      preferencias: PREFS,
      mes: '2026-05',
    });
    expect(r.blocos.find((b) => b.data === '2026-05-04')).toBeUndefined();
  });

  test('ids prefixados com sug-', () => {
    const r = sugerirPlantoes({ blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05' });
    for (const b of r.blocos) {
      expect(String(b.id).startsWith('sug-')).toBe(true);
    }
  });

  test('zero hospitais = zero sugestões', () => {
    const r = sugerirPlantoes({
      blocos: [],
      hospitais: {},
      preferencias: PREFS,
      mes: '2026-05',
    });
    expect(r.blocos).toEqual([]);
  });

  test('para quando atinge meta', () => {
    const meta1k: Preferencias = { ...PREFS, metaMensal: 1500 };
    const r = sugerirPlantoes({
      blocos: [],
      hospitais: HOSPITAIS,
      preferencias: meta1k,
      mes: '2026-05',
    });
    // 1 plantão público de R$ 1800 já passa de R$ 1500 (líquido ~1305)
    // 2 plantões já bate · não vai mais que 2-3
    expect(r.blocos.length).toBeLessThanOrEqual(3);
  });
});
