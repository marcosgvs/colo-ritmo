import { describe, expect, test } from 'vitest';
import type { BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { analisarMesAnterior, mesAnteriorISO } from './diagnostico.js';

const HOSPITAIS: HospitaisMap = {
  HSL: {
    id: 'HSL',
    nome: 'HSL',
    abrev: 'HSL',
    cor: 'sand',
    tipo: 'privado',
    valorPlantao: 1800,
    valorHora: 150,
    adicionalNoite: 200,
    setores: [],
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 0,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: [],
      maxPorMes: 8,
    },
  },
};

const PREFS: Preferencias = {
  nome: 'teste',
  metaMensal: 22000,
  diasPreferidos: [],
  diasEvitar: [],
  hospitaisPreferidos: ['HSL'],
  evitar24hCorrido: true,
  maxPlantoesPorSemana: 4,
  janelaPreferida: 'dia',
};

function plantao(id: string, data: string, ini: number, dur: number): BlocoPlantao {
  return {
    id, tipo: 'plantao', hospitalId: 'HSL', data,
    horaInicio: ini, duracao: dur, setor: 'enfermaria',
  };
}

describe('mesAnteriorISO', () => {
  test('mês comum', () => {
    expect(mesAnteriorISO('2026-05')).toBe('2026-04');
  });
  test('janeiro vira dezembro do ano anterior', () => {
    expect(mesAnteriorISO('2026-01')).toBe('2025-12');
  });
});

describe('analisarMesAnterior', () => {
  test('mês vazio classifica como tranquilo', () => {
    const r = analisarMesAnterior([], HOSPITAIS, '2026-05', PREFS);
    expect(r.mesISO).toBe('2026-04');
    expect(r.classificacao).toBe('tranquilo');
    expect(r.lenteSugerida).toBe('equilibrar');
    expect(r.plantoes).toBe(0);
    expect(r.receita).toBe(0);
  });

  test('mês com 3 dias seguidos classifica como pesado', () => {
    const blocos = [
      plantao('1', '2026-04-13', 7, 12),
      plantao('2', '2026-04-14', 7, 12),
      plantao('3', '2026-04-15', 7, 12),
    ];
    const r = analisarMesAnterior(blocos, HOSPITAIS, '2026-05', PREFS);
    expect(r.classificacao).toBe('pesado');
    expect(r.lenteSugerida).toBe('descansar');
    expect(r.diasSeguidosMax).toBeGreaterThanOrEqual(3);
  });

  test('mês com recuperação invadida classifica como pesado', () => {
    const blocos = [
      plantao('noturno', '2026-04-10', 19, 12), // termina dia 11 às 7h
      plantao('manha', '2026-04-11', 7, 5),     // dia 11 7-12h · invade
    ];
    const r = analisarMesAnterior(blocos, HOSPITAIS, '2026-05', PREFS);
    expect(r.classificacao).toBe('pesado');
    expect(r.recuperacoesInvadidas).toBeGreaterThan(0);
  });

  test('mês com pouca receita classifica como caro', () => {
    // 1 plantão sozinho, longe da meta de 22k
    const blocos = [plantao('1', '2026-04-10', 7, 12)];
    const r = analisarMesAnterior(blocos, HOSPITAIS, '2026-05', PREFS);
    expect(r.classificacao).toBe('caro');
    expect(r.lenteSugerida).toBe('ganhar');
    expect(r.pctMeta).not.toBeNull();
    expect(r.pctMeta!).toBeLessThan(85);
  });

  test('mês ok em descanso e receita classifica como tranquilo', () => {
    // 12 plantões espalhados, sem 3 seguidos
    const blocos: BlocoPlantao[] = [];
    for (let i = 0; i < 12; i++) {
      const dia = String(1 + i * 2).padStart(2, '0');
      blocos.push(plantao(`p${i}`, `2026-04-${dia}`, 7, 12));
    }
    const r = analisarMesAnterior(blocos, HOSPITAIS, '2026-05', PREFS);
    expect(r.diasSeguidosMax).toBeLessThan(3);
    expect(r.recuperacoesInvadidas).toBe(0);
    // 12 plantões diurnos × ~1800 = 21600 ≈ meta · ~98% · não é caro
    expect(r.classificacao).toBe('tranquilo');
    expect(r.lenteSugerida).toBe('equilibrar');
  });
});
