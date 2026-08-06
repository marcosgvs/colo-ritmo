import { describe, expect, it } from 'vitest';
import type { Janela, TurnoEquipe } from '@/types';
import {
  agruparPorDiaJanela,
  diasDoMes,
  fmtDuracao,
  fmtHorarioJanela,
  mesPorExtenso,
  nomeArquivoEquipe,
  obsDoMesOrdenadas,
  rotuloDiaCurto,
  rotuloDiaLongo,
  slugNome,
  turnosDoMedicoOrdenados,
} from './pdfEquipe';

const JANELAS: Janela[] = [
  { rotulo: 'dia', inicio: 7, duracao: 12 },
  { rotulo: 'noitinha', inicio: 18.5, duracao: 5.5 },
  { rotulo: 'noite', inicio: 19, duracao: 12 },
];

describe('fmtHorarioJanela', () => {
  it('formata janela diurna inteira', () => {
    expect(fmtHorarioJanela({ rotulo: 'dia', inicio: 7, duracao: 12 })).toBe('07:00–19:00');
  });

  it('formata início decimal como :30', () => {
    expect(fmtHorarioJanela({ rotulo: 'x', inicio: 19.5, duracao: 12 })).toBe('19:30–07:30');
  });

  it('cruza meia-noite', () => {
    expect(fmtHorarioJanela({ rotulo: 'noite', inicio: 19, duracao: 12 })).toBe('19:00–07:00');
  });
});

describe('fmtDuracao', () => {
  it('horas inteiras viram Nh', () => {
    expect(fmtDuracao(12)).toBe('12h');
    expect(fmtDuracao(0)).toBe('0h');
  });

  it('meia hora vira NhMM', () => {
    expect(fmtDuracao(5.5)).toBe('5h30');
    expect(fmtDuracao(19.25)).toBe('19h15');
  });
});

describe('slugNome', () => {
  it('remove acento, minúsculo, espaço vira hífen', () => {
    expect(slugNome('Mariana Araújo')).toBe('mariana-araujo');
    expect(slugNome('José da Conceição')).toBe('jose-da-conceicao');
  });

  it('colapsa separadores e apara bordas', () => {
    expect(slugNome('  Dr.  João  ')).toBe('dr-joao');
    expect(slugNome('HSL/z')).toBe('hsl-z');
  });
});

describe('nomeArquivoEquipe', () => {
  it('completo', () => {
    expect(nomeArquivoEquipe('HCB', '2026-07')).toBe('escala-hcb-2026-07.pdf');
  });

  it('por médico com slug', () => {
    expect(nomeArquivoEquipe('HSLz', '2026-07', 'Mariana Araújo')).toBe(
      'escala-hslz-2026-07-mariana-araujo.pdf',
    );
  });

  it('abrev vazia cai no fallback', () => {
    expect(nomeArquivoEquipe('', '2026-07')).toBe('escala-hospital-2026-07.pdf');
  });
});

describe('diasDoMes', () => {
  it('julho tem 31 dias em ordem', () => {
    const dias = diasDoMes('2026-07');
    expect(dias).toHaveLength(31);
    expect(dias[0]).toBe('2026-07-01');
    expect(dias[30]).toBe('2026-07-31');
  });

  it('fevereiro bissexto tem 29', () => {
    expect(diasDoMes('2024-02')).toHaveLength(29);
    expect(diasDoMes('2026-02')).toHaveLength(28);
  });
});

describe('mesPorExtenso', () => {
  it('capitaliza o mês', () => {
    expect(mesPorExtenso('2026-07')).toBe('Julho de 2026');
    expect(mesPorExtenso('2026-03')).toBe('Março de 2026');
  });
});

describe('rotuloDiaCurto', () => {
  it('dia da semana curto + dia com zero à esquerda', () => {
    // 2026-07-01 é quarta-feira
    expect(rotuloDiaCurto('2026-07-01')).toBe('Qua 01');
    // 2026-07-04 é sábado
    expect(rotuloDiaCurto('2026-07-04')).toBe('Sáb 04');
  });
});

describe('rotuloDiaLongo', () => {
  it('dias úteis levam -feira', () => {
    expect(rotuloDiaLongo('2026-07-01')).toBe('Quarta-feira, 01/07');
    expect(rotuloDiaLongo('2026-07-06')).toBe('Segunda-feira, 06/07');
  });

  it('sábado e domingo não levam -feira', () => {
    expect(rotuloDiaLongo('2026-07-04')).toBe('Sábado, 04/07');
    expect(rotuloDiaLongo('2026-07-05')).toBe('Domingo, 05/07');
  });
});

describe('agruparPorDiaJanela', () => {
  const turnos: TurnoEquipe[] = [
    { data: '2026-07-01', janela: 'dia', medico: 'Carla' },
    { data: '2026-07-01', janela: 'dia', medico: 'Ana' },
    { data: '2026-07-01', janela: 'noite', medico: 'Bruno' },
    { data: '2026-07-02', janela: 'dia', medico: 'Zeca' }, // fora do roster
  ];
  const roster = ['Ana', 'Bruno', 'Carla'];

  it('agrupa por data|janela e ordena pela ordem do roster', () => {
    const mapa = agruparPorDiaJanela(turnos, roster);
    expect(mapa.get('2026-07-01|dia')).toEqual(['Ana', 'Carla']);
    expect(mapa.get('2026-07-01|noite')).toEqual(['Bruno']);
  });

  it('médico fora do roster não some da célula', () => {
    const mapa = agruparPorDiaJanela(turnos, roster);
    expect(mapa.get('2026-07-02|dia')).toEqual(['Zeca']);
  });

  it('dia sem turno não gera chave', () => {
    const mapa = agruparPorDiaJanela(turnos, roster);
    expect(mapa.has('2026-07-03|dia')).toBe(false);
  });
});

describe('obsDoMesOrdenadas', () => {
  it('filtra pro mês, apara e ordena por data', () => {
    const obs = {
      '2026-07-20': '  fecha mais cedo  ',
      '2026-07-03': 'feriado',
      '2026-06-30': 'de outro mês',
      '2026-07-10': '   ',
    };
    expect(obsDoMesOrdenadas(obs, '2026-07')).toEqual([
      { data: '2026-07-03', texto: 'feriado' },
      { data: '2026-07-20', texto: 'fecha mais cedo' },
    ]);
  });

  it('sem obs retorna vazio', () => {
    expect(obsDoMesOrdenadas(undefined, '2026-07')).toEqual([]);
    expect(obsDoMesOrdenadas({}, '2026-07')).toEqual([]);
  });
});

describe('turnosDoMedicoOrdenados', () => {
  const turnos: TurnoEquipe[] = [
    { data: '2026-07-10', janela: 'noite', medico: 'Ana' },
    { data: '2026-07-02', janela: 'noite', medico: 'Ana' },
    { data: '2026-07-02', janela: 'dia', medico: 'Ana' },
    { data: '2026-07-05', janela: 'dia', medico: 'Bruno' },
  ];

  it('filtra só o médico e ordena por data e início da janela', () => {
    const lista = turnosDoMedicoOrdenados(turnos, JANELAS, 'Ana');
    expect(lista.map((t) => `${t.data}|${t.janela}`)).toEqual([
      '2026-07-02|dia',
      '2026-07-02|noite',
      '2026-07-10|noite',
    ]);
  });

  it('médico sem turno retorna vazio', () => {
    expect(turnosDoMedicoOrdenados(turnos, JANELAS, 'Carla')).toEqual([]);
  });
});
