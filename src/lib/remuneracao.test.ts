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
  test('público CLT diurno · plantão não soma valor (fixo entra uma vez no mês)', () => {
    const b: Bloco = { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 12, setor: '' };
    const r = calcRemuneracaoBloco(b, HBDF);
    expect(r.bruto).toBe(0);
    expect(r.noturno).toBe(false);
  });

  test('público CLT noturno · plantão soma só o adicional noturno', () => {
    const b: Bloco = { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 19, duracao: 12, setor: '' };
    const r = calcRemuneracaoBloco(b, HBDF);
    expect(r.bruto).toBe(250);
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
    // HBDF público CLT: valorFixo 1800 (uma vez) + 1 noturno = 1800 + 250 = 2050
    // HSL privado: valorHora 150 * 6 = 900
    // total bruto: 2050 + 900 = 2950
    expect(r.total.bruto).toBe(2950);
  });

  test('mês vazio retorna zero', () => {
    const r = calcRemuneracaoMes([], HOSPITAIS, '2026-05');
    expect(r.total.bruto).toBe(0);
    expect(r.porHospital).toEqual({});
  });
});
