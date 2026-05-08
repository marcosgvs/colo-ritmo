import { describe, expect, test } from 'vitest';
import {
  adicionaDia,
  diaSemanaBR,
  diasEntre,
  ehISO,
  fimDaSemana,
  fimDoMes,
  fmtDate,
  fmtHora,
  fmtRange,
  fromISO,
  inicioDaSemana,
  inicioDoMes,
  semanaDe,
  toISO,
} from './dates';

describe('ehISO', () => {
  test('aceita YYYY-MM-DD', () => {
    expect(ehISO('2026-05-04')).toBe(true);
    expect(ehISO('2026-12-31')).toBe(true);
  });

  test('rejeita formatos errados', () => {
    expect(ehISO('2026-5-4')).toBe(false);
    expect(ehISO('2026/05/04')).toBe(false);
    expect(ehISO('04-05-2026')).toBe(false);
    expect(ehISO('')).toBe(false);
    expect(ehISO(null)).toBe(false);
    expect(ehISO(undefined)).toBe(false);
    expect(ehISO(20260504)).toBe(false);
  });
});

describe('toISO / fromISO · roundtrip', () => {
  test('roundtrip preserva data', () => {
    const original = '2026-05-08';
    expect(toISO(fromISO(original))).toBe(original);
  });

  test('toISO usa data local, não UTC', () => {
    const d = new Date(2026, 4, 8); // maio = mês 4
    expect(toISO(d)).toBe('2026-05-08');
  });

  test('fromISO falha em formato errado', () => {
    expect(() => fromISO('2026-5-8')).toThrow();
  });
});

describe('adicionaDia', () => {
  test('soma simples', () => {
    expect(adicionaDia('2026-05-04', 1)).toBe('2026-05-05');
    expect(adicionaDia('2026-05-04', 7)).toBe('2026-05-11');
  });

  test('subtração', () => {
    expect(adicionaDia('2026-05-04', -1)).toBe('2026-05-03');
  });

  test('atravessa fim de mês', () => {
    expect(adicionaDia('2026-05-31', 1)).toBe('2026-06-01');
    expect(adicionaDia('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('ano bissexto', () => {
    expect(adicionaDia('2024-02-28', 1)).toBe('2024-02-29');
    expect(adicionaDia('2024-02-29', 1)).toBe('2024-03-01');
    expect(adicionaDia('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('diasEntre', () => {
  test('zero quando iguais', () => {
    expect(diasEntre('2026-05-04', '2026-05-04')).toBe(0);
  });

  test('positivo quando b>a', () => {
    expect(diasEntre('2026-05-04', '2026-05-10')).toBe(6);
  });

  test('negativo quando b<a', () => {
    expect(diasEntre('2026-05-10', '2026-05-04')).toBe(-6);
  });

  test('atravessa mês', () => {
    expect(diasEntre('2026-05-30', '2026-06-02')).toBe(3);
  });
});

describe('diaSemanaBR', () => {
  // segunda 4 mai 2026 = 0
  test('segunda = 0', () => {
    expect(diaSemanaBR('2026-05-04')).toBe(0);
  });
  test('domingo = 6', () => {
    expect(diaSemanaBR('2026-05-10')).toBe(6);
  });
  test('quinta = 3', () => {
    expect(diaSemanaBR('2026-05-07')).toBe(3);
  });
});

describe('inicioDaSemana / fimDaSemana', () => {
  test('inicio em qualquer dia da semana volta pra segunda', () => {
    expect(inicioDaSemana('2026-05-04')).toBe('2026-05-04');
    expect(inicioDaSemana('2026-05-08')).toBe('2026-05-04');
    expect(inicioDaSemana('2026-05-10')).toBe('2026-05-04');
  });

  test('fim em qualquer dia da semana avança pro domingo', () => {
    expect(fimDaSemana('2026-05-04')).toBe('2026-05-10');
    expect(fimDaSemana('2026-05-10')).toBe('2026-05-10');
  });

  test('atravessa virada de mês', () => {
    expect(inicioDaSemana('2026-06-01')).toBe('2026-06-01');
    expect(inicioDaSemana('2026-06-02')).toBe('2026-06-01');
    expect(fimDaSemana('2026-05-30')).toBe('2026-05-31');
  });
});

describe('inicioDoMes / fimDoMes', () => {
  test('mês de 31 dias', () => {
    expect(inicioDoMes('2026-05-15')).toBe('2026-05-01');
    expect(fimDoMes('2026-05-15')).toBe('2026-05-31');
  });

  test('fevereiro normal', () => {
    expect(fimDoMes('2026-02-10')).toBe('2026-02-28');
  });

  test('fevereiro bissexto', () => {
    expect(fimDoMes('2024-02-10')).toBe('2024-02-29');
  });

  test('virada de ano', () => {
    expect(fimDoMes('2026-12-15')).toBe('2026-12-31');
  });
});

describe('fmtDate', () => {
  test('exibe dow + dia + mês minúsculo', () => {
    // 4 mai 2026 = segunda · 7 = quinta · 8 = sexta · 10 = domingo
    expect(fmtDate('2026-05-04')).toBe('seg 4 mai');
    expect(fmtDate('2026-05-07')).toBe('qui 7 mai');
    expect(fmtDate('2026-05-08')).toBe('sex 8 mai');
    expect(fmtDate('2026-05-10')).toBe('dom 10 mai');
  });
});

describe('fmtHora / fmtRange', () => {
  test('zero-pad horas inteiras', () => {
    expect(fmtHora(7)).toBe('07:00');
    expect(fmtHora(19)).toBe('19:00');
    expect(fmtHora(0)).toBe('00:00');
  });

  test('decimal vira minutos', () => {
    expect(fmtHora(7.5)).toBe('07:30');
    expect(fmtHora(13.25)).toBe('13:15');
  });

  test('fmtRange cruza meia-noite', () => {
    expect(fmtRange(19, 12)).toBe('19:00 → 07:00');
    expect(fmtRange(7, 6)).toBe('07:00 → 13:00');
  });
});

describe('semanaDe', () => {
  test('retorna 7 datas seg→dom', () => {
    const semana = semanaDe('2026-05-08');
    expect(semana).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ]);
  });
});
