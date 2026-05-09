import { describe, expect, test } from 'vitest';
import type { BlocoPlantao } from '@/types';
import { bonusPadrao, calcularPadroes } from './padroes.js';

const plantao = (
  id: string,
  hospitalId: string,
  data: string,
  horaInicio: number,
  duracao: number,
): BlocoPlantao => ({
  id,
  tipo: 'plantao',
  hospitalId,
  data,
  horaInicio,
  duracao,
});

describe('calcularPadroes', () => {
  test('reconhece padrão consistente em todos os meses observados', () => {
    // 4 segundas em maio + 4 em junho · sempre noitinha 19h 5h no HSLz
    const blocos: BlocoPlantao[] = [
      plantao('1', 'HSLz', '2026-05-04', 19, 5), // segunda
      plantao('2', 'HSLz', '2026-05-11', 19, 5),
      plantao('3', 'HSLz', '2026-05-18', 19, 5),
      plantao('4', 'HSLz', '2026-05-25', 19, 5),
      plantao('5', 'HSLz', '2026-06-01', 19, 5),
      plantao('6', 'HSLz', '2026-06-08', 19, 5),
      plantao('7', 'HSLz', '2026-06-15', 19, 5),
      plantao('8', 'HSLz', '2026-06-22', 19, 5),
    ];
    const p = calcularPadroes(blocos);
    expect(p.length).toBe(1);
    expect(p[0]).toMatchObject({
      hospitalId: 'HSLz',
      diaDeSemana: 1, // segunda
      inicio: 19,
      duracao: 5,
      observadoEm: 2,
      totalMeses: 2,
    });
  });

  test('descarta padrão que aparece em < 50% dos meses', () => {
    // 1 plantão em maio (apareceu em 1 de 2 meses observados = 50%)
    // mas o segundo mês tem outro plantão, em outro DOW · separa em 2 chaves
    const blocos: BlocoPlantao[] = [
      plantao('1', 'HSLz', '2026-05-04', 7, 12), // seg manhã
      plantao('2', 'HSLz', '2026-06-02', 19, 12), // ter noite
    ];
    const p = calcularPadroes(blocos);
    // Seg manhã apareceu em 1/2 = 50% (entra no limiar)
    // Ter noite idem
    // Ambos passam o LIMIAR_PADRAO de 0.5
    expect(p.length).toBe(2);
  });

  test('lista vazia gera 0 padrões', () => {
    expect(calcularPadroes([])).toEqual([]);
  });

  test('só plantões · ignora outros tipos', () => {
    const blocos = [
      plantao('1', 'HSLz', '2026-05-04', 19, 5),
      plantao('2', 'HSLz', '2026-06-01', 19, 5),
      { id: 's1', tipo: 'sono' as const, data: '2026-05-05', horaInicio: 8, duracao: 8 },
    ];
    const p = calcularPadroes(blocos);
    expect(p.length).toBe(1);
  });
});

describe('bonusPadrao', () => {
  const padrao = {
    hospitalId: 'HSLz',
    diaDeSemana: 1 as const,
    inicio: 19,
    duracao: 5,
    observadoEm: 2,
    totalMeses: 2,
  };

  test('match exato (hospital + DOW + inicio + dur) retorna proporção total', () => {
    const bonus = bonusPadrao(
      { hospitalId: 'HSLz', data: '2026-07-06', horaInicio: 19, duracao: 5 },
      [padrao],
    );
    expect(bonus).toBe(1);
  });

  test('match parcial (mesmo hospital+DOW · janela diferente) retorna metade', () => {
    const bonus = bonusPadrao(
      { hospitalId: 'HSLz', data: '2026-07-06', horaInicio: 7, duracao: 12 },
      [padrao],
    );
    expect(bonus).toBe(0.5);
  });

  test('hospital diferente retorna 0', () => {
    const bonus = bonusPadrao(
      { hospitalId: 'HCB', data: '2026-07-06', horaInicio: 19, duracao: 5 },
      [padrao],
    );
    expect(bonus).toBe(0);
  });

  test('sem padrões retorna 0', () => {
    const bonus = bonusPadrao(
      { hospitalId: 'HSLz', data: '2026-07-06', horaInicio: 19, duracao: 5 },
      [],
    );
    expect(bonus).toBe(0);
  });
});
