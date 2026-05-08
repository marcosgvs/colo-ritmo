import { describe, expect, test } from 'vitest';
import type { Bloco, Hospital, HospitaisMap } from '@/types';
import { calcRemuneracaoBloco, calcRemuneracaoMes, ehNoturno } from './remuneracao';

const HBDF: Hospital = {
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
};

const HSL: Hospital = {
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
};

const HOSPITAIS: HospitaisMap = { HBDF, HSL };

describe('ehNoturno', () => {
  test('19-7h é noturno', () => {
    expect(
      ehNoturno({ id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 19, duracao: 12, setor: '' }),
    ).toBe(true);
  });

  test('7-19h é diurno', () => {
    expect(
      ehNoturno({ id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 12, setor: '' }),
    ).toBe(false);
  });

  test('madrugada é noturno', () => {
    expect(
      ehNoturno({ id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 0, duracao: 6, setor: '' }),
    ).toBe(true);
  });
});

describe('calcRemuneracaoBloco', () => {
  test('público diurno usa valorFixo', () => {
    const b: Bloco = { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 12, setor: '' };
    const r = calcRemuneracaoBloco(b, HBDF);
    expect(r.bruto).toBe(1800);
    expect(r.noturno).toBe(false);
    expect(r.liquido).toBe(Math.round(1800 * 0.725));
  });

  test('público noturno soma adicional', () => {
    const b: Bloco = { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 19, duracao: 12, setor: '' };
    const r = calcRemuneracaoBloco(b, HBDF);
    expect(r.bruto).toBe(1800 + 250);
    expect(r.noturno).toBe(true);
  });

  test('privado usa valorHora * duracao', () => {
    const b: Bloco = { id: 1, tipo: 'plantao', hospitalId: 'HSL', data: '2026-05-04', horaInicio: 7, duracao: 6, setor: '' };
    const r = calcRemuneracaoBloco(b, HSL);
    expect(r.bruto).toBe(150 * 6);
    expect(r.liquido).toBe(Math.round(150 * 6 * 0.94));
  });
});

describe('calcRemuneracaoMes', () => {
  test('agrupa por hospital · ignora cedido', () => {
    const blocos: Bloco[] = [
      { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 12, setor: 'UTI' },
      { id: 2, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-08', horaInicio: 19, duracao: 12, setor: 'PS' },
      { id: 3, tipo: 'plantao', hospitalId: 'HSL', data: '2026-05-06', horaInicio: 7, duracao: 6, setor: 'enf' },
      { id: 4, tipo: 'cedido', hospitalId: 'HBDF', data: '2026-05-15', horaInicio: 7, duracao: 12, cedidoPara: 'Dra X' },
      { id: 5, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-04-29', horaInicio: 7, duracao: 12, setor: 'UTI' }, // outro mês
    ];
    const r = calcRemuneracaoMes(blocos, HOSPITAIS, '2026-05');
    expect(r.porHospital['HBDF']?.plantoes).toBe(2);
    expect(r.porHospital['HSL']?.plantoes).toBe(1);
    // total bruto: 1800 + (1800+250) + 150*6 = 4750
    expect(r.total.bruto).toBe(4750);
  });

  test('mês vazio retorna zero', () => {
    const r = calcRemuneracaoMes([], HOSPITAIS, '2026-05');
    expect(r.total.bruto).toBe(0);
    expect(r.porHospital).toEqual({});
  });
});
