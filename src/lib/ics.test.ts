import { describe, expect, test } from 'vitest';
import type { Bloco, Hospital, HospitaisMap } from '@/types';
import { eventoParaBloco, gerarICS, parsearICS } from './ics';

const HBDF: Hospital = {
  id: 'HBDF',
  nome: 'Hospital de Base do DF',
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

const HOSPITAIS: HospitaisMap = { HBDF };

describe('parsearICS', () => {
  test('parse mínimo VEVENT', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc-123
SUMMARY:Plantão UTI
DTSTART:20260504T070000
DTEND:20260504T190000
END:VEVENT
END:VCALENDAR`;
    const eventos = parsearICS(ics);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.uid).toBe('abc-123');
    expect(eventos[0]?.summary).toBe('Plantão UTI');
    expect(eventos[0]?.dtStart).toBe('20260504T070000');
  });

  test('múltiplos eventos', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1
DTSTART:20260504T070000
DTEND:20260504T130000
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20260506T130000
DTEND:20260506T190000
END:VEVENT
END:VCALENDAR`;
    expect(parsearICS(ics)).toHaveLength(2);
  });

  test('line unfolding · linha continuada com espaço (RFC 5545 strip leading space)', () => {
    // RFC 5545: única separação é o break-de-linha, espaço inicial é
    // marker e some na unfold. Pra ter espaço no conteúdo, a linha
    // anterior tem que terminar com espaço (ou o conteúdo começa com
    // dois espaços). Validamos o comportamento canônico aqui.
    const linhas = ['BEGIN:VEVENT', 'UID:1', 'SUMMARY:UTI ', ' Pediátrica HBDF', 'DTSTART:20260504T070000', 'DTEND:20260504T190000', 'END:VEVENT'];
    const ics = linhas.join('\r\n');
    const e = parsearICS(ics)[0];
    expect(e?.summary).toBe('UTI Pediátrica HBDF');
  });

  test('escape de vírgula e ponto-e-vírgula', () => {
    const ics = `BEGIN:VEVENT
UID:1
SUMMARY:UTI Pediátrica\\, leito 4
DTSTART:20260504T070000
DTEND:20260504T190000
END:VEVENT`;
    const e = parsearICS(ics)[0];
    expect(e?.summary).toBe('UTI Pediátrica, leito 4');
  });

  test('evento sem dtstart/dtend é processado mas vira null em eventoParaBloco', () => {
    const ics = `BEGIN:VEVENT
UID:1
SUMMARY:Sem datas
END:VEVENT`;
    const e = parsearICS(ics)[0]!;
    expect(eventoParaBloco(e, { id: 1, hospitalId: 'HBDF' })).toBeNull();
  });
});

describe('eventoParaBloco', () => {
  test('plantão diurno simples', () => {
    const ics = `BEGIN:VEVENT
UID:1
SUMMARY:UTI
DTSTART:20260504T070000
DTEND:20260504T190000
END:VEVENT`;
    const evt = parsearICS(ics)[0]!;
    const b = eventoParaBloco(evt, { id: 1, hospitalId: 'HBDF', setor: 'UTI Pediátrica' });
    expect(b).toEqual({
      id: 1,
      tipo: 'plantao',
      hospitalId: 'HBDF',
      data: '2026-05-04',
      horaInicio: 7,
      duracao: 12,
      setor: 'UTI Pediátrica',
    });
  });

  test('plantão noturno cruza meia-noite', () => {
    const ics = `BEGIN:VEVENT
UID:1
DTSTART:20260504T190000
DTEND:20260505T070000
END:VEVENT`;
    const evt = parsearICS(ics)[0]!;
    const b = eventoParaBloco(evt, { id: 1, hospitalId: 'HBDF' });
    expect(b?.data).toBe('2026-05-04');
    expect(b?.horaInicio).toBe(19);
    expect(b?.duracao).toBe(12);
  });

  test('hora com minutos (07:30)', () => {
    const ics = `BEGIN:VEVENT
UID:1
DTSTART:20260504T073000
DTEND:20260504T190000
END:VEVENT`;
    const evt = parsearICS(ics)[0]!;
    const b = eventoParaBloco(evt, { id: 1, hospitalId: 'HBDF' });
    expect(b?.horaInicio).toBe(7.5);
    expect(b?.duracao).toBe(11.5);
  });
});

describe('gerarICS', () => {
  test('produz VCALENDAR válido', () => {
    const blocos: Bloco[] = [
      {
        id: 1,
        tipo: 'plantao',
        hospitalId: 'HBDF',
        data: '2026-05-04',
        horaInicio: 7,
        duracao: 12,
        setor: 'UTI Pediátrica',
      },
    ];
    const ics = gerarICS(blocos, HOSPITAIS, { nome: 'Mariana' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('SUMMARY:HBDF · UTI Pediátrica');
    expect(ics).toContain('DTSTART:20260504T070000');
    expect(ics).toContain('DTEND:20260504T190000');
    expect(ics).toContain('UID:colo-ritmo-1@hbdf.colopediatria');
  });

  test('plantão noturno gera DTEND no dia seguinte', () => {
    const blocos: Bloco[] = [
      {
        id: 7,
        tipo: 'plantao',
        hospitalId: 'HBDF',
        data: '2026-05-04',
        horaInicio: 19,
        duracao: 12,
        setor: 'UTI',
      },
    ];
    const ics = gerarICS(blocos, HOSPITAIS, { nome: 'Mariana' });
    expect(ics).toContain('DTSTART:20260504T190000');
    expect(ics).toContain('DTEND:20260505T070000');
  });

  test('roundtrip · gerar e re-parsear preserva dados', () => {
    const blocos: Bloco[] = [
      {
        id: 1,
        tipo: 'plantao',
        hospitalId: 'HBDF',
        data: '2026-05-04',
        horaInicio: 7,
        duracao: 12,
        setor: 'UTI',
      },
    ];
    const ics = gerarICS(blocos, HOSPITAIS, { nome: 'Mariana' });
    const eventos = parsearICS(ics);
    expect(eventos).toHaveLength(1);
    const re = eventoParaBloco(eventos[0]!, { id: 1, hospitalId: 'HBDF', setor: 'UTI' });
    expect(re).toEqual(blocos[0]);
  });

  test('ignora cedido/sono/bloqueio', () => {
    const blocos: Bloco[] = [
      { id: 1, tipo: 'sono', data: '2026-05-04', horaInicio: 19, duracao: 8 },
      { id: 2, tipo: 'bloqueio', data: '2026-05-09', horaInicio: 0, duracao: 24 },
      { id: 3, tipo: 'cedido', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 6, cedidoPara: 'X' },
    ];
    const ics = gerarICS(blocos, HOSPITAIS, { nome: 'Mariana' });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
