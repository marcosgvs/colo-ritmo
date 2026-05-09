import { describe, expect, test } from 'vitest';
import type { BlocoPlantao, Hospital } from '@/types';
import {
  agruparPorHospital,
  fmtMesAnoExtenso,
  montarCSV,
  montarMensagem,
  nomeArquivo,
} from './exportar.js';

const HOSP_HSL: Hospital = {
  id: 'HSL',
  nome: 'Hospital Santa Lúcia',
  abrev: 'HSL',
  cor: 'sand',
  tipo: 'privado',
  valorPlantao: 1800,
  valorHora: 150,
  adicionalNoite: 200,
  setores: ['enfermaria'],
  regras: {
    maxPorSemana: 2,
    minFimDeSemana: 0,
    intervaloMinHoras: 11,
    duracaoPlantao: 12,
    janelas: [],
    maxPorMes: 8,
  },
};

const HOSP_HBDF: Hospital = {
  ...HOSP_HSL,
  id: 'HBDF',
  nome: 'Hospital de Base do DF',
  abrev: 'HBDF',
};

function plantao(id: string, hospId: string, data: string, ini: number, dur: number): BlocoPlantao {
  return {
    id, tipo: 'plantao', hospitalId: hospId, data,
    horaInicio: ini, duracao: dur,
  };
}

describe('fmtMesAnoExtenso', () => {
  test('formata mês ISO em Português padrão', () => {
    expect(fmtMesAnoExtenso('2026-05')).toBe('maio de 2026');
    expect(fmtMesAnoExtenso('2026-01')).toBe('janeiro de 2026');
  });
});

describe('montarMensagem', () => {
  test('mensagem usa Português padrão (capitalização e pontuação)', () => {
    const txt = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [plantao('1', 'HSL', '2026-06-03', 7, 12)],
      mesISO: '2026-06',
      nomeMedico: 'Dra. Mariana',
      nomeChefe: 'Dr. Roberto',
    });
    // Não duplica "Dr." quando o nome já vem com tratamento
    expect(txt).toContain('Olá, Dr. Roberto!');
    expect(txt).not.toContain('Dr(a). Dr.');
    expect(txt).toContain('Hospital Santa Lúcia');
    expect(txt).toContain('junho de 2026');
    expect(txt).toContain('Atenciosamente');
    expect(txt).toContain('Dra. Mariana');
    // Nada minúsculo na saudação, nem nos cabeçalhos
    expect(txt.startsWith('Olá')).toBe(true);
  });

  test('sem chefe nomeado usa saudação genérica', () => {
    const txt = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [plantao('1', 'HSL', '2026-06-03', 7, 12)],
      mesISO: '2026-06',
      nomeMedico: 'Dra. Mariana',
    });
    expect(txt).toContain('Olá!');
    expect(txt).not.toContain('Dr(a). undefined');
  });

  test('chefe sem prefixo recebe Dr(a). adicionado', () => {
    const txt = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [plantao('1', 'HSL', '2026-06-03', 7, 12)],
      mesISO: '2026-06',
      nomeMedico: 'Dra. M',
      nomeChefe: 'Roberto',
    });
    expect(txt).toContain('Olá, Dr(a). Roberto!');
  });

  test('singular vs plural', () => {
    const um = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [plantao('1', 'HSL', '2026-06-03', 7, 12)],
      mesISO: '2026-06',
      nomeMedico: 'Dra. M',
    });
    expect(um).toContain('1 plantão');
    expect(um).not.toContain('1 plantões');

    const tres = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [
        plantao('1', 'HSL', '2026-06-03', 7, 12),
        plantao('2', 'HSL', '2026-06-05', 7, 12),
        plantao('3', 'HSL', '2026-06-08', 7, 12),
      ],
      mesISO: '2026-06',
      nomeMedico: 'Dra. M',
    });
    expect(tres).toContain('3 plantões');
  });

  test('plantões aparecem em ordem cronológica', () => {
    const txt = montarMensagem({
      hospital: HOSP_HSL,
      plantoes: [
        plantao('a', 'HSL', '2026-06-15', 7, 12),
        plantao('b', 'HSL', '2026-06-03', 7, 12),
        plantao('c', 'HSL', '2026-06-08', 7, 12),
      ],
      mesISO: '2026-06',
      nomeMedico: 'Dra. M',
    });
    const idx3 = txt.indexOf('3 de junho');
    const idx8 = txt.indexOf('8 de junho');
    const idx15 = txt.indexOf('15 de junho');
    expect(idx3).toBeGreaterThan(0);
    expect(idx8).toBeGreaterThan(idx3);
    expect(idx15).toBeGreaterThan(idx8);
  });
});

describe('montarCSV', () => {
  test('inclui BOM UTF-8 + cabeçalho em Português padrão', () => {
    const csv = montarCSV({
      hospital: HOSP_HSL,
      plantoes: [plantao('1', 'HSL', '2026-06-03', 7, 12)],
      mesISO: '2026-06',
      nomeMedico: 'Dra. M',
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Data;Dia;Início;Fim;Duração');
    expect(csv).toContain('Hospital Santa Lúcia');
    expect(csv).toContain('Quarta');
  });
});

describe('agruparPorHospital', () => {
  test('agrupa plantões por hospitalId', () => {
    const plantoes = [
      plantao('1', 'HSL', '2026-06-03', 7, 12),
      plantao('2', 'HBDF', '2026-06-04', 7, 12),
      plantao('3', 'HSL', '2026-06-05', 7, 12),
    ];
    const r = agruparPorHospital(plantoes, { HSL: HOSP_HSL, HBDF: HOSP_HBDF });
    expect(r.length).toBe(2);
    const hsl = r.find((g) => g.hospital.id === 'HSL');
    const hbdf = r.find((g) => g.hospital.id === 'HBDF');
    expect(hsl?.plantoes.length).toBe(2);
    expect(hbdf?.plantoes.length).toBe(1);
  });

  test('ignora plantões cujo hospital não foi cadastrado', () => {
    const plantoes = [plantao('1', 'XX', '2026-06-03', 7, 12)];
    const r = agruparPorHospital(plantoes, { HSL: HOSP_HSL });
    expect(r.length).toBe(0);
  });
});

describe('nomeArquivo', () => {
  test('formato esperado', () => {
    expect(nomeArquivo(HOSP_HSL, '2026-06', 'csv')).toBe('colo-ritmo_hsl_2026-06.csv');
  });
});
