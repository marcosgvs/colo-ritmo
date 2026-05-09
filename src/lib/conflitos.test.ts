import { describe, expect, test } from 'vitest';
import type { Bloco, HospitaisMap } from '@/types';
import { cargaSemanal, detectarConflitos } from './conflitos';

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
    setores: [],
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 0,
      intervaloMinHoras: 12,
      duracaoPlantao: 12,
      janelas: [],
      maxPorMes: 10,
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
    setores: [],
    regras: {
      maxPorSemana: 1,
      minFimDeSemana: 0,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: [],
      maxPorMes: 8,
    },
  },
};

function plantao(id: number, hosp: string, data: string, hora: number, dur: number): Bloco {
  return {
    id,
    tipo: 'plantao',
    hospitalId: hosp,
    data,
    horaInicio: hora,
    duracao: dur,
    setor: 'UTI',
  };
}

describe('cargaSemanal', () => {
  test('soma só plantões', () => {
    const blocos: Bloco[] = [
      plantao(1, 'HBDF', '2026-05-04', 7, 12),
      plantao(2, 'HSL', '2026-05-06', 13, 6),
      { id: 3, tipo: 'sono', data: '2026-05-04', horaInicio: 19, duracao: 8 },
      { id: 4, tipo: 'bloqueio', data: '2026-05-09', horaInicio: 0, duracao: 24 },
    ];
    expect(cargaSemanal(blocos)).toBe(18);
  });

  test('vazio = 0', () => {
    expect(cargaSemanal([])).toBe(0);
  });
});

describe('detectarConflitos · sobreposicao', () => {
  test('sobreposição direta', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 12),
      plantao(2, 'HSL', '2026-05-04', 13, 6), // sobrepõe 13-19
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'sobreposicao')).toBeDefined();
  });

  test('grudados (fim de A = início de B) não é sobreposição', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 6), // 7→13
      plantao(2, 'HSL', '2026-05-04', 13, 6), // 13→19
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'sobreposicao')).toBeUndefined();
  });
});

describe('detectarConflitos · sem_descanso', () => {
  test('gap < intervalo mínimo do hospital', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 12), // 7→19
      plantao(2, 'HBDF', '2026-05-05', 0, 12), // 5h gap < 12h
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    const semDescanso = c.find((x) => x.tipo === 'sem_descanso');
    expect(semDescanso).toBeDefined();
    expect(semDescanso?.detalhe).toMatch(/5\.0h/);
  });

  test('gap suficiente · sem conflito', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 6), // 7→13
      plantao(2, 'HBDF', '2026-05-05', 7, 6), // 18h gap
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'sem_descanso')).toBeUndefined();
  });

  test('jornada estendida no mesmo hospital · não é conflito (manhã + tarde)', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 6), // manhã 7→13
      plantao(2, 'HBDF', '2026-05-04', 13, 6), // tarde 13→19 · gap 0
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'sem_descanso')).toBeUndefined();
  });

  test('jornada estendida com gap pequeno (< 30min) · não é conflito', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 6), // 7→13
      plantao(2, 'HBDF', '2026-05-04', 13.25, 6), // 13:15→19:15 · gap 15min
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'sem_descanso')).toBeUndefined();
  });

  test('hospitais diferentes mesmo com gap zero · ainda é conflito (tem que se deslocar)', () => {
    const blocos = [
      plantao(1, 'HBDF', '2026-05-04', 7, 6), // 7→13
      plantao(2, 'HSL', '2026-05-04', 13, 6), // 13→19 outro hospital
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    // O caso de gap=0 entre hospitais diferentes vira sobreposição (porque tempo de deslocamento)
    // ou sem_descanso · qualquer dos dois é correto sinalizar.
    expect(
      c.find((x) => x.tipo === 'sobreposicao' || x.tipo === 'sem_descanso'),
    ).toBeDefined();
  });
});

describe('detectarConflitos · max_semana por hospital', () => {
  test('passa do max do hospital', () => {
    const blocos = [
      plantao(1, 'HSL', '2026-05-04', 7, 6),
      plantao(2, 'HSL', '2026-05-06', 7, 6), // HSL maxPorSemana = 1
    ];
    const c = detectarConflitos(blocos, HOSPITAIS);
    expect(c.find((x) => x.tipo === 'max_semana')).toBeDefined();
  });
});
