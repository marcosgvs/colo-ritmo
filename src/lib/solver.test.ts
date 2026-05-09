import { describe, expect, test } from 'vitest';
import type { Bloco, HospitaisMap, Preferencias } from '@/types';
import { compararLentes, sugerirPlantoes } from './solver.js';

const HOSPITAIS: HospitaisMap = {
  HBDF: {
    id: 'HBDF',
    nome: 'HBDF',
    abrev: 'HBDF',
    cor: 'blue',
    tipo: 'publico',
    valorPlantao: 1800,
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

  test('para quando atinge meta · lente equilibrar (default)', () => {
    const meta1k: Preferencias = { ...PREFS, metaMensal: 1500 };
    const r = sugerirPlantoes({
      blocos: [],
      hospitais: HOSPITAIS,
      preferencias: meta1k,
      mes: '2026-05',
    });
    expect(r.blocos.length).toBeLessThanOrEqual(3);
    expect(r.lente).toBe('equilibrar');
  });
});

describe('lentes do solver', () => {
  test('lente descansar gera menos sugestões que ganhar', () => {
    const descansar = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'descansar',
    });
    const ganhar = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'ganhar',
    });
    expect(descansar.blocos.length).toBeLessThanOrEqual(ganhar.blocos.length);
  });

  test('lente descansar nunca cria 3+ dias seguidos', () => {
    const r = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'descansar',
    });
    expect(r.resumo.diasSeguidosMax).toBeLessThan(3);
  });

  test('lente descansar nunca invade recuperação', () => {
    const r = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'descansar',
    });
    expect(r.resumo.recuperacoesInvadidas).toBe(0);
  });

  test('lente ganhar tende a render mais que equilibrar', () => {
    const eq = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'equilibrar',
    });
    const gn = sugerirPlantoes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
      lente: 'ganhar',
    });
    expect(gn.resumo.receitaEstimada).toBeGreaterThanOrEqual(eq.resumo.receitaEstimada);
  });

  test('compararLentes devolve as 3 sugestões', () => {
    const c = compararLentes({
      blocos: [], hospitais: HOSPITAIS, preferencias: PREFS, mes: '2026-05',
    });
    expect(c.descansar.lente).toBe('descansar');
    expect(c.equilibrar.lente).toBe('equilibrar');
    expect(c.ganhar.lente).toBe('ganhar');
  });
});
