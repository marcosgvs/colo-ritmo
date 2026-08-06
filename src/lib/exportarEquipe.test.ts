import { describe, expect, it } from 'vitest';
import type { DadosPDFEquipe } from './pdfEquipe';
import { icsEquipe, textoEquipeGeral, textoEquipeMedico } from './exportarEquipe';

// Setembro de 2026: dia 01 é terça · dia 05 é sábado · dia 10 é quinta.
const BASE: DadosPDFEquipe = {
  hospitalNome: 'Hospital da Criança de Brasília',
  hospitalAbrev: 'HCB',
  mesISO: '2026-09',
  janelas: [
    { rotulo: 'manhã', inicio: 7, duracao: 6 },
    { rotulo: 'noite', inicio: 19, duracao: 12 },
  ],
  turnos: [
    { data: '2026-09-01', janela: 'manhã', medico: 'Ana Silva' },
    { data: '2026-09-01', janela: 'manhã', medico: 'Bia Costa' },
    { data: '2026-09-01', janela: 'noite', medico: 'Carla' },
    { data: '2026-09-05', janela: 'noite', medico: 'Ana Silva' },
  ],
  medicos: ['Ana Silva', 'Bia Costa', 'Carla'],
};

const COM_OBS: DadosPDFEquipe = {
  ...BASE,
  obs: {
    '2026-09-01': 'Feriado municipal',
    '2026-09-10': 'Reunião da equipe às 14h',
    '2026-08-31': 'de outro mês · não entra',
  },
};

describe('textoEquipeGeral', () => {
  it('cabeçalho formal + rodapé', () => {
    const txt = textoEquipeGeral(BASE);
    expect(txt.startsWith('Escala de Plantões — Hospital da Criança de Brasília\nSetembro de 2026\n\n')).toBe(true);
    expect(txt.endsWith('Gerado pelo Colo Ritmo')).toBe(true);
  });

  it('dia com turnos: janelas na ordem, nomes na ordem do roster', () => {
    const txt = textoEquipeGeral(BASE);
    expect(txt).toContain(
      'Ter 01/09\n  Manhã (07:00–13:00): Ana Silva · Bia Costa\n  Noite (19:00–07:00): Carla',
    );
    expect(txt).toContain('Sáb 05/09\n  Noite (19:00–07:00): Ana Silva');
  });

  it('dia vazio fica de fora · janela vazia é omitida', () => {
    const txt = textoEquipeGeral(BASE);
    expect(txt).not.toContain('02/09');
    // 05/09 só tem noite · manhã não aparece no bloco do dia
    expect(txt).not.toContain('Sáb 05/09\n  Manhã');
  });

  it('obs entra na linha do dia · dia só com obs também aparece', () => {
    const txt = textoEquipeGeral(COM_OBS);
    expect(txt).toContain('  Obs.: Feriado municipal');
    expect(txt).toContain('Qui 10/09\n  Obs.: Reunião da equipe às 14h');
  });

  it('obs de outro mês não vaza', () => {
    expect(textoEquipeGeral(COM_OBS)).not.toContain('de outro mês');
  });

  it('sem obs não imprime "Obs.:"', () => {
    expect(textoEquipeGeral(BASE)).not.toContain('Obs.:');
  });
});

describe('textoEquipeMedico', () => {
  it('cabeçalho com Dr(a). + uma linha por turno', () => {
    const txt = textoEquipeMedico(BASE, 'Ana Silva');
    expect(txt).toContain('Escala de Plantões — Hospital da Criança de Brasília\nSetembro de 2026\nDr(a). Ana Silva\n\n');
    expect(txt).toContain('Terça-feira, 01/09 — Manhã (07:00–13:00)');
    expect(txt).toContain('Sábado, 05/09 — Noite (19:00–07:00)');
  });

  it('totais: horas do mês, horas de fds e nº de plantões', () => {
    const txt = textoEquipeMedico(BASE, 'Ana Silva');
    // manhã 6h + noite 12h = 18h · sábado à noite = 12h de fds
    expect(txt).toContain('Total no mês: 18h · Fins de semana: 12h · Plantões: 2');
  });

  it('não mistura turnos de outro médico', () => {
    const txt = textoEquipeMedico(BASE, 'Carla');
    expect(txt).toContain('Terça-feira, 01/09 — Noite (19:00–07:00)');
    expect(txt).not.toContain('Manhã');
    expect(txt).toContain('Plantões: 1');
  });

  it('médico sem plantão', () => {
    const txt = textoEquipeMedico(BASE, 'Bia Costa');
    expect(txt).toContain('Terça-feira, 01/09 — Manhã');
    const vazio = textoEquipeMedico({ ...BASE, turnos: [] }, 'Bia Costa');
    expect(vazio).toContain('Nenhum plantão registrado neste mês.');
    expect(vazio).toContain('Plantões: 0');
  });
});

describe('icsEquipe', () => {
  it('escala inteira: um VEVENT por turno, com nome do médico no SUMMARY', () => {
    const ics = icsEquipe(BASE);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('SUMMARY:Plantão HCB — Manhã — Ana Silva');
    expect(ics).toContain('SUMMARY:Plantão HCB — Noite — Carla');
  });

  it('estrutura VCALENDAR com CRLF', () => {
    const ics = icsEquipe(BASE);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Colo Ritmo//Equipe//PT\r\nCALSCALE:GREGORIAN\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // toda quebra é CRLF
  });

  it('todo VEVENT tem DTSTAMP em UTC', () => {
    const ics = icsEquipe(BASE);
    const stamps = ics.match(/DTSTAMP:\d{8}T\d{6}Z/g);
    expect(stamps).toHaveLength(4);
  });

  it('com medico filtra só os turnos dele e tira o nome do SUMMARY', () => {
    const ics = icsEquipe(BASE, 'Ana Silva');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('SUMMARY:Plantão HCB — Manhã\r\n');
    expect(ics).toContain('SUMMARY:Plantão HCB — Noite\r\n');
    expect(ics).not.toContain('— Ana Silva');
    expect(ics).not.toContain('carla');
  });

  it('horário local flutuante · overnight vira dia seguinte no DTEND', () => {
    const ics = icsEquipe(BASE, 'Ana Silva');
    // manhã: mesmo dia
    expect(ics).toContain('DTSTART:20260901T070000\r\nDTEND:20260901T130000');
    // noite de sábado 05: termina domingo 06 às 07:00 · sem Z
    expect(ics).toContain('DTSTART:20260905T190000\r\nDTEND:20260906T070000');
    expect(ics).not.toMatch(/DTSTART:[^\r]*Z/);
  });

  it('UID determinístico com slugs', () => {
    const ics = icsEquipe(BASE);
    expect(ics).toContain(
      'UID:equipe-hcb-2026-09-01-manha-ana-silva@colopediatria.com.br',
    );
    expect(ics).toContain(
      'UID:equipe-hcb-2026-09-05-noite-ana-silva@colopediatria.com.br',
    );
  });

  it('escapa vírgula em texto (LOCATION)', () => {
    const ics = icsEquipe({ ...BASE, hospitalNome: 'Hospital X, Unidade Sul' });
    expect(ics).toContain('LOCATION:Hospital X\\, Unidade Sul');
  });

  it('turno de janela removida não gera evento quebrado', () => {
    const ics = icsEquipe({
      ...BASE,
      turnos: [...BASE.turnos, { data: '2026-09-08', janela: 'fantasma', medico: 'Carla' }],
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).not.toContain('fantasma');
  });
});
