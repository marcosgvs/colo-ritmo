import { describe, expect, test } from 'vitest';
import type { BlocoPlantao } from '@/types';
import {
  analisarDescanso,
  espelhoDescanso,
  faixaRecuperacao,
  faixasRecuperacaoNaSemana,
  RECUPERACAO_NOITE_HORAS,
} from './descanso.js';

function plantao(
  id: string,
  data: string,
  horaInicio: number,
  duracao: number,
): BlocoPlantao {
  return {
    id,
    tipo: 'plantao',
    hospitalId: 'HSL',
    data,
    horaInicio,
    duracao,
    setor: 'enfermaria',
  };
}

describe('faixaRecuperacao', () => {
  test('plantão diurno não tem faixa de recuperação', () => {
    const p = plantao('1', '2026-05-05', 7, 12);
    expect(faixaRecuperacao(p)).toBeNull();
  });

  test('plantão que cruza meia-noite tem faixa de 12h após o fim', () => {
    const p = plantao('1', '2026-05-05', 19, 12); // 19h ter → 7h qua
    const f = faixaRecuperacao(p);
    expect(f).not.toBeNull();
    expect(f!.fim - f!.ini).toBe(RECUPERACAO_NOITE_HORAS);
  });

  test('plantão tarde-noite (19-00h) também conta como noturno', () => {
    const p = plantao('1', '2026-05-05', 19, 5);
    expect(faixaRecuperacao(p)).not.toBeNull();
  });
});

describe('analisarDescanso · cenário-cilada', () => {
  // Exemplo concreto que motivou esse módulo:
  //   ter 5 mai · 13-19h + 19-07h
  //   qua 6 mai · 13-19h + 19-00h
  //   qui 7 mai · 07-19h + 19-00h
  // Mariana vê qua de manhã "livre" e quer pegar 07-12h. Precisa ver
  // que aquilo é recuperação do plantão noturno de terça.
  const cenario: BlocoPlantao[] = [
    plantao('a', '2026-05-05', 13, 6),
    plantao('b', '2026-05-05', 19, 12),
    plantao('c', '2026-05-06', 13, 6),
    plantao('d', '2026-05-06', 19, 5),
    plantao('e', '2026-05-07', 7, 12),
    plantao('f', '2026-05-07', 19, 5),
  ];

  test('detecta 3 dias seguidos rodando', () => {
    const r = analisarDescanso(cenario, '2026-05-04', '2026-05-08');
    expect(r.diasSeguidos).toBeGreaterThanOrEqual(3);
    expect(r.alerta3DiasSeguidos).toBe(true);
  });

  test('aceitar plantão extra qua 07-12h invade recuperação do noturno de terça', () => {
    const novo = plantao('novo', '2026-05-06', 7, 5); // 07h qua
    const cenarioSemNovo = cenario.filter((p) => p.id !== 'novo');
    const r = analisarDescanso(
      cenarioSemNovo,
      '2026-05-04',
      '2026-05-08',
      novo,
    );
    const invadido = r.recuperacoesInvadidas.find((x) => x.invadidoPor.id === 'novo');
    expect(invadido).toBeDefined();
    expect(invadido!.plantao.id).toBe('b'); // 19-07 de terça
  });

  test('aceitar 07-12h da qua aumenta horas de recuperação invadidas', () => {
    const semNovo = analisarDescanso(cenario, '2026-05-04', '2026-05-08');
    const novo = plantao('novo', '2026-05-06', 7, 5);
    const comNovo = analisarDescanso(
      cenario,
      '2026-05-04',
      '2026-05-08',
      novo,
    );
    expect(comNovo.horasRecuperacaoInvadidas).toBeGreaterThan(
      semNovo.horasRecuperacaoInvadidas,
    );
  });
});

describe('faixasRecuperacaoNaSemana', () => {
  const semana = [
    '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07',
    '2026-05-08', '2026-05-09', '2026-05-10',
  ];

  test('plantão noturno seguido de descanso longo: nada pintado', () => {
    const blocos = [plantao('1', '2026-05-05', 19, 12)];
    expect(faixasRecuperacaoNaSemana(blocos, semana)).toEqual([]);
  });

  test('plantão noturno seguido de plantão dentro da janela de 12h: pinta o gap', () => {
    const blocos = [
      plantao('noturno', '2026-05-05', 19, 12), // termina qua 7h
      plantao('manha', '2026-05-06', 7, 5),     // qua 7-12h
    ];
    const r = faixasRecuperacaoNaSemana(blocos, semana);
    // gap entre fim noturno (qua 7h) e início manha (qua 7h) = 0h.
    // Esperado nenhum (ou faixa de duração zero filtrada).
    expect(r.every((f) => f.duracao > 0)).toBe(true);
  });

  test('noturno seguido de plantão tarde no mesmo dia · pinta de manhã', () => {
    const blocos = [
      plantao('noturno', '2026-05-05', 19, 12),  // termina qua 7h
      plantao('tarde', '2026-05-06', 13, 6),     // qua 13-19h
    ];
    const r = faixasRecuperacaoNaSemana(blocos, semana);
    const cinzaQua = r.find((f) => f.data === '2026-05-06');
    expect(cinzaQua).toBeDefined();
    expect(cinzaQua!.iniHora).toBe(7);
    expect(cinzaQua!.duracao).toBe(6); // 7h-13h
  });
});

describe('espelhoDescanso', () => {
  test('plantão diurno isolado num oceano vazio: delta zero ou pequeno', () => {
    const novo = plantao('novo', '2026-05-15', 7, 12);
    const r = espelhoDescanso([], novo, 1);
    expect(r.depois.diasSeguidos).toBe(1);
    expect(r.depois.alerta3DiasSeguidos).toBe(false);
  });

  test('plantão extra que invade recuperação sinaliza piora', () => {
    const ja: BlocoPlantao[] = [plantao('noturno', '2026-05-05', 19, 12)];
    const novo = plantao('novo', '2026-05-06', 7, 5);
    const r = espelhoDescanso(ja, novo, 1);
    expect(r.piora).toBe(true);
    expect(r.deltaInvasao).toBeGreaterThan(0);
    expect(r.depois.recuperacoesInvadidas.length).toBeGreaterThan(0);
  });

  test('antes vs depois usam a mesma janela', () => {
    const ja: BlocoPlantao[] = [plantao('a', '2026-05-05', 7, 12)];
    const novo = plantao('novo', '2026-05-07', 7, 12);
    const r = espelhoDescanso(ja, novo, 1);
    // ambos são analisados sobre 2026-05-06 → 2026-05-08
    expect(r.antes.diasSeguidos).toBeLessThanOrEqual(r.depois.diasSeguidos);
  });
});
