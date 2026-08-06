import { describe, expect, test } from 'vitest';
import type { EscalaImportada, Janela, TurnoEquipe } from '@/types';
import {
  conflitosEquipe,
  medicosDaImportada,
  resumoPorMedico,
  semanasDoMes,
} from './equipe';

const JANELAS: Janela[] = [
  { rotulo: 'dia', inicio: 7, duracao: 12 },
  { rotulo: 'noite', inicio: 19, duracao: 12 },
];

describe('medicosDaImportada', () => {
  test('únicos, ordenados por frequência, sem vazios', () => {
    const esc: EscalaImportada = {
      hospitalId: 'HCB',
      ano: 2026,
      mes: 6,
      importadaEm: '',
      janelas: JANELAS,
      celulas: [
        { data: '2026-06-01', turno: 'dia', nomes: ['Ana', 'Bia'] },
        { data: '2026-06-02', turno: 'dia', nomes: ['Bia', ' '] },
        { data: '2026-06-03', turno: 'noite', nomes: ['Bia', 'Carla'] },
      ],
    };
    expect(medicosDaImportada(esc)).toEqual(['Bia', 'Ana', 'Carla']);
  });
});

describe('semanasDoMes', () => {
  test('julho 2026 tem 5 semanas · começa na seg 29/06 e cobre 31/07', () => {
    const semanas = semanasDoMes('2026-07');
    expect(semanas).toHaveLength(5);
    expect(semanas[0]![0]).toBe('2026-06-29');
    expect(semanas[4]!).toContain('2026-07-31');
  });
});

describe('resumoPorMedico', () => {
  const turnos: TurnoEquipe[] = [
    { data: '2026-07-06', janela: 'dia', medico: 'Ana' },   // seg · semana 2
    { data: '2026-07-11', janela: 'noite', medico: 'Ana' }, // sáb · fds
    { data: '2026-07-12', janela: 'dia', medico: 'Bia' },   // dom · fds
  ];

  test('total, fds e distribuição por semana', () => {
    const [ana, bia, caio] = resumoPorMedico(['Ana', 'Bia', 'Caio'], turnos, JANELAS, '2026-07');
    expect(ana).toMatchObject({ plantoes: 2, total: 24, fds: 12 });
    expect(ana!.porSemana[1]).toBe(24); // 6 e 11/jul caem na 2ª linha do calendário
    expect(bia).toMatchObject({ plantoes: 1, total: 12, fds: 12 });
    expect(caio).toMatchObject({ plantoes: 0, total: 0, fds: 0 });
  });

  test('turno de médico fora do roster não conta', () => {
    const [ana] = resumoPorMedico(['Ana'], [{ data: '2026-07-06', janela: 'dia', medico: 'X' }], JANELAS, '2026-07');
    expect(ana!.total).toBe(0);
  });
});

describe('conflitosEquipe', () => {
  test('mesmo médico, mesmo dia, janelas sobrepostas → conflito nos dois lados', () => {
    const turnos: TurnoEquipe[] = [
      { data: '2026-07-06', janela: 'dia', medico: 'Ana' },
      { data: '2026-07-06', janela: 'dia', medico: 'Ana' },
    ];
    const c = conflitosEquipe(turnos, JANELAS);
    expect(c.has('Ana|2026-07-06|dia')).toBe(true);
  });

  test('noite que vira o dia colide com o dia seguinte', () => {
    const turnos: TurnoEquipe[] = [
      { data: '2026-07-06', janela: 'noite', medico: 'Ana' }, // 19h → 07h de 07/07
      { data: '2026-07-07', janela: 'dia', medico: 'Ana' },   // 07h → 19h... começa exatamente quando acaba
      { data: '2026-07-07', janela: 'noite', medico: 'Bia' },
    ];
    // fim 07:00 = início 07:00 · sem sobreposição real, sem conflito
    expect(conflitosEquipe(turnos, JANELAS).size).toBe(0);
    // agora com janela que invade de fato
    const invasao: TurnoEquipe[] = [
      { data: '2026-07-06', janela: 'noite', medico: 'Ana' },
      { data: '2026-07-07', janela: 'madrugada', medico: 'Ana' },
    ];
    const jan = [...JANELAS, { rotulo: 'madrugada', inicio: 0, duracao: 7 }];
    const c = conflitosEquipe(invasao, jan);
    expect(c.has('Ana|2026-07-06|noite')).toBe(true);
    expect(c.has('Ana|2026-07-07|madrugada')).toBe(true);
  });

  test('médicos diferentes no mesmo turno não conflitam', () => {
    const turnos: TurnoEquipe[] = [
      { data: '2026-07-06', janela: 'dia', medico: 'Ana' },
      { data: '2026-07-06', janela: 'dia', medico: 'Bia' },
    ];
    expect(conflitosEquipe(turnos, JANELAS).size).toBe(0);
  });
});
