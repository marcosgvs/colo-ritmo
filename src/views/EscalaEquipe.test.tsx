// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { EscalaEquipe as EscalaEquipeT, EscalaImportada, Hospital, HospitaisMap } from '@/types';
import { setHospitaisRuntime } from '@/lib/data';
import { EscalaEquipe } from './EscalaEquipe';

// jsPDF pesa e não roda em jsdom · os geradores são testados à parte;
// as funções puras que a view usa ganham stubs equivalentes.
vi.mock('@/lib/pdfEquipe', () => ({
  baixarPDFEquipeCompleto: vi.fn().mockResolvedValue(undefined),
  baixarPDFEquipeMedico: vi.fn().mockResolvedValue(undefined),
  fmtHorarioJanela: (j: { inicio: number; duracao: number }) => `${j.inicio}:00–${(j.inicio + j.duracao) % 24}:00`,
  mesPorExtenso: (m: string) => m,
  rotuloDiaCurto: (iso: string) => iso.slice(8),
  slugNome: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/exportarEquipe', () => ({
  baixarArquivoTexto: vi.fn(),
  baixarXLSXEquipe: vi.fn().mockResolvedValue(undefined),
  icsEquipe: vi.fn().mockReturnValue('BEGIN:VCALENDAR'),
  textoEquipeGeral: vi.fn().mockReturnValue('texto'),
  textoEquipeMedico: vi.fn().mockReturnValue('texto'),
}));

import { baixarArquivoTexto, textoEquipeMedico } from '@/lib/exportarEquipe';

const HCB: Hospital = {
  id: 'HCB',
  nome: 'Hospital da Criança',
  abrev: 'HCB',
  cor: 'blue',
  tipo: 'publico',
  valorPlantao: 1800,
  adicionalNoite: 0,
  setores: [],
  regras: {},
  janelas: [
    { rotulo: 'dia', inicio: 7, duracao: 12 },
    { rotulo: 'noitinha', inicio: 19, duracao: 5 },
    { rotulo: 'noite', inicio: 19, duracao: 12 },
  ],
};

const HOSPITAIS: HospitaisMap = { HCB };
setHospitaisRuntime(HOSPITAIS);

function mesAlvo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const IMPORTADA: EscalaImportada = {
  hospitalId: 'HCB',
  ano: 2026,
  mes: 6,
  importadaEm: '2026-06-01',
  janelas: HCB.janelas!,
  celulas: [
    // 2026-06-01 = 1ª segunda de junho
    { data: '2026-06-01', turno: 'dia', nomes: ['Mariana', 'Paula'] },
    { data: '2026-06-02', turno: 'noite', nomes: ['Paula'] },
  ],
};

function mockDesktop(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  );
}

function montar(escalasEquipe: EscalaEquipeT[] = [], escalasImportadas: EscalaImportada[] = [IMPORTADA]) {
  const onSalvar = vi.fn();
  render(
    <EscalaEquipe
      hospitais={HOSPITAIS}
      escalasImportadas={escalasImportadas}
      escalasEquipe={escalasEquipe}
      onSalvar={onSalvar}
    />,
  );
  return { onSalvar };
}

function rascunhoComEquipe(): EscalaEquipeT {
  return {
    hospitalId: 'HCB',
    mesISO: mesAlvo(),
    medicos: ['Mariana', 'Paula'],
    janelas: [
      { rotulo: 'dia', inicio: 7, duracao: 12 },
      { rotulo: 'noite', inicio: 19, duracao: 12 },
    ],
    turnos: [{ data: `${mesAlvo()}-10`, janela: 'dia', medico: 'Mariana' }],
    atualizadaEm: '',
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('EscalaEquipe · montar', () => {
  test('sem rascunho, "noitinha" nasce desligada (só dia e noite na grade)', () => {
    mockDesktop();
    montar();
    const toggleNoitinha = screen.getByRole('button', { name: /noitinha/ });
    expect(toggleNoitinha.getAttribute('aria-pressed')).toBe('false');
    // slot de noitinha não existe na grade
    expect(screen.queryByRole('button', { name: `turno noitinha de ${mesAlvo()}-01` })).toBeNull();
    expect(screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-01` })).toBeTruthy();
  });

  test('puxar a escala antiga traz nomes E posições (mesmo dia-da-semana/ordinal)', () => {
    mockDesktop();
    const { onSalvar } = montar();
    fireEvent.click(screen.getByRole('button', { name: /puxar a escala de jun\/2026/ }));
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.medicos).toEqual(['Paula', 'Mariana']);
    // celula da 1ª segunda de junho migra pra 1ª segunda do mês alvo
    const [ano, mes] = mesAlvo().split('-').map(Number);
    const primeiro = new Date(ano!, mes! - 1, 1);
    const offset = (1 - (primeiro.getDay() === 0 ? 7 : primeiro.getDay()) + 7) % 7;
    const primeiraSegunda = `${mesAlvo()}-${String(1 + offset).padStart(2, '0')}`;
    expect(salvo.turnos).toContainEqual({ data: primeiraSegunda, janela: 'dia', medico: 'Mariana' });
    expect(salvo.turnos).toContainEqual({ data: primeiraSegunda, janela: 'dia', medico: 'Paula' });
  });

  test('selecionar médico e clicar num turno escala · clicar no chip escalado remove', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    const roster = screen.getByText('equipe').parentElement!;
    fireEvent.click(within(roster).getByRole('button', { name: 'Paula' }));
    fireEvent.click(screen.getByRole('button', { name: `turno noite de ${mesAlvo()}-12` }));
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.turnos).toContainEqual({ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' });

    const slot = screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-10` });
    fireEvent.click(within(slot).getByRole('button', { name: /Mariana/ }));
    const salvo2 = onSalvar.mock.calls[1]![0] as EscalaEquipeT;
    expect(salvo2.turnos).toEqual([{ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' }]);
  });

  test('obs do dia salva no blur', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    const campo = screen.getByLabelText(`observação de ${mesAlvo()}-10`);
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: '* Mariana até 13h' } });
    expect(onSalvar).not.toHaveBeenCalled(); // digitar não salva
    fireEvent.blur(campo);
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.obs).toEqual({ [`${mesAlvo()}-10`]: '* Mariana até 13h' });
  });

  test('desfazer volta o movimento e refazer aplica de novo', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    const roster = screen.getByText('equipe').parentElement!;
    fireEvent.click(within(roster).getByRole('button', { name: 'Paula' }));
    fireEvent.click(screen.getByRole('button', { name: `turno noite de ${mesAlvo()}-12` }));
    // escalou (call 0) · desfaz (call 1) · refaz (call 2)
    fireEvent.click(screen.getByRole('button', { name: 'desfazer' }));
    const desfeito = onSalvar.mock.calls[1]![0] as EscalaEquipeT;
    expect(desfeito.turnos).toEqual([{ data: `${mesAlvo()}-10`, janela: 'dia', medico: 'Mariana' }]);
    fireEvent.click(screen.getByRole('button', { name: 'refazer' }));
    const refeito = onSalvar.mock.calls[2]![0] as EscalaEquipeT;
    expect(refeito.turnos).toContainEqual({ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' });
    // sinalização do movimento por extenso
    expect(screen.getByText(/refeito · escalou Paula/)).toBeTruthy();
  });

  test('lista de salvas aparece e carrega ao clicar', () => {
    mockDesktop();
    const outra: EscalaEquipeT = { ...rascunhoComEquipe(), mesISO: '2026-01', turnos: [] };
    montar([rascunhoComEquipe(), outra]);
    expect(screen.getByText('salvas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /jan 2026 · 0 turnos/ }));
    // carregou a de janeiro: painel de status mostra o mês
    expect(screen.getByText('jan 2026')).toBeTruthy();
  });
});

describe('EscalaEquipe · revisar e exportar', () => {
  test('salvar e exportar abre a tabela completa com os nomes', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    fireEvent.click(screen.getByRole('button', { name: 'salvar e exportar ›' }));
    expect(screen.getByText('confere e manda.')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Mariana')).toBeTruthy();
    // voltar funciona
    fireEvent.click(screen.getByRole('button', { name: '‹ voltar pra editar' }));
    expect(screen.getByText('o mês do time inteiro.')).toBeTruthy();
  });

  test('export por médico baixa txt com o nome no arquivo', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    fireEvent.click(screen.getByRole('button', { name: 'salvar e exportar ›' }));
    const linhaMariana = screen.getByText('um pra cada médico').parentElement!;
    fireEvent.click(within(linhaMariana).getAllByRole('button', { name: 'txt' })[0]!);
    expect(textoEquipeMedico).toHaveBeenCalledWith(expect.anything(), 'Mariana');
    expect(baixarArquivoTexto).toHaveBeenCalledWith(
      `escala-hcb-${mesAlvo()}-mariana.txt`,
      'texto',
    );
  });

  test('sem turnos o botão salvar e exportar fica desabilitado', () => {
    mockDesktop();
    montar([{ ...rascunhoComEquipe(), turnos: [] }]);
    const btn = screen.getByRole('button', { name: 'salvar e exportar ›' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('EscalaEquipe · mobile', () => {
  test('mostra o aviso de desktop', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    );
    montar();
    expect(screen.getByText('melhor no computador.')).toBeTruthy();
  });
});
