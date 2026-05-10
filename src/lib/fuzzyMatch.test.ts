import { describe, expect, test } from 'vitest';
import { fuzzyMatch, normalizarNome } from './fuzzyMatch';

describe('normalizarNome', () => {
  test('lowercases', () => {
    expect(normalizarNome('Mpinheiro')).toBe('mpinheiro');
  });

  test('strips accents', () => {
    expect(normalizarNome('Mária')).toBe('maria');
    expect(normalizarNome('JOÃO')).toBe('joao');
  });

  test('strips Dr/Dra prefix', () => {
    expect(normalizarNome('Dra. Mpinheiro')).toBe('mpinheiro');
    expect(normalizarNome('Dr Pinheiro')).toBe('pinheiro');
  });

  test('strips hospital unit suffixes', () => {
    expect(normalizarNome('Kariny BHP')).toBe('kariny');
    expect(normalizarNome('Aline CEP')).toBe('aline');
    expect(normalizarNome('LuAlice CRO')).toBe('lualice');
    expect(normalizarNome('Raquel CP')).toBe('raquel');
    expect(normalizarNome('Ste Pr')).toBe('ste');
  });

  test('strips extra/swap markers', () => {
    expect(normalizarNome('Mpinheiro*')).toBe('mpinheiro');
    expect(normalizarNome('Mariana²')).toBe('mariana');
  });
});

describe('fuzzyMatch · matches verdadeiros', () => {
  test('exato', () => {
    expect(fuzzyMatch('Mpinheiro', 'Mpinheiro')).toBe(true);
  });

  test('case insensitive', () => {
    expect(fuzzyMatch('MPINHEIRO', 'mpinheiro')).toBe(true);
    expect(fuzzyMatch('MPinheiro', 'Mpinheiro')).toBe(true);
  });

  test('com sufixo de unidade', () => {
    expect(fuzzyMatch('Mpinheiro BHP', 'Mpinheiro')).toBe(true);
  });

  test('com prefixo Dra.', () => {
    expect(fuzzyMatch('Dra. Mpinheiro', 'Mpinheiro')).toBe(true);
  });

  test('typo · letra faltando', () => {
    expect(fuzzyMatch('Mpinhero', 'Mpinheiro')).toBe(true);
    expect(fuzzyMatch('MPnheiro', 'Mpinheiro')).toBe(true);
  });

  test('typo · letra a mais', () => {
    expect(fuzzyMatch('Marianna', 'Mariana')).toBe(true);
  });

  test('typo · 1 substituição', () => {
    expect(fuzzyMatch('Mariane', 'Mariana')).toBe(true);
  });
});

describe('fuzzyMatch · não-matches críticos', () => {
  // O bug original: Marilia foi confundida com Mariana porque ambos têm
  // 7 chars e distância 2. A regra agora exige distância <= 1 → não bate.
  test('Mariana ≠ Marilia (nome diferente, não typo)', () => {
    expect(fuzzyMatch('Marilia', 'Mariana')).toBe(false);
  });

  test('Mpinheiro ≠ Mariana', () => {
    expect(fuzzyMatch('Mariana', 'Mpinheiro')).toBe(false);
  });

  test('Mpinheiro ≠ Marilia', () => {
    expect(fuzzyMatch('Marilia', 'Mpinheiro')).toBe(false);
  });

  test('Mpinheiro ≠ Mayana', () => {
    expect(fuzzyMatch('Mayana', 'Mpinheiro')).toBe(false);
  });

  test('Mpinheiro ≠ Murilo', () => {
    expect(fuzzyMatch('Murilo', 'Mpinheiro')).toBe(false);
  });

  test('nomes muito curtos (< 4) precisam ser exatos', () => {
    expect(fuzzyMatch('Ana', 'Ane')).toBe(false);
    expect(fuzzyMatch('Ana', 'Ana')).toBe(true);
  });

  test('strings vazias não casam', () => {
    expect(fuzzyMatch('', 'Mariana')).toBe(false);
    expect(fuzzyMatch('Mariana', '')).toBe(false);
  });
});
