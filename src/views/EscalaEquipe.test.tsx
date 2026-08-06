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
  fmtHorarioJanela: (j: { inicio: number; duracao: number }) =>
    `${j.inicio}:00–${(j.inicio + j.duracao) % 24}:00`,
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

/** Etapa 1 → 2 · sem puxar a escala antiga (desmarca o checkbox). */
function abrirCalendario(): void {
  const check = screen.queryByRole('checkbox');
  if (check && (check as HTMLInputElement).checked) fireEvent.click(check);
  fireEvent.click(screen.getByRole('button', { name: 'abrir o calendário ›' }));
}

/** Roster no calendário (a caixa "equipe · N"). */
function roster(): HTMLElement {
  return screen.getByRole('button', { name: /expandir a equipe|diminuir a equipe/ }).parentElement!
    .parentElement!;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('EscalaEquipe · etapa 1 (setup)', () => {
  test('abre no setup com mês, checkbox de puxar e turnos · noitinha desligada', () => {
    mockDesktop();
    montar();
    expect(screen.getByText('qual mês vamos montar?')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: /noitinha/ }).getAttribute('aria-pressed')).toBe('false');
    // o calendário só existe na etapa 2
    expect(screen.queryByRole('button', { name: `turno dia de ${mesAlvo()}-01` })).toBeNull();
  });

  test('checkbox marcado puxa nomes E posições ao abrir o calendário', () => {
    mockDesktop();
    const { onSalvar } = montar();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'abrir o calendário ›' }));
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.medicos).toEqual(['Paula', 'Mariana']);
    const [ano, mes] = mesAlvo().split('-').map(Number);
    const primeiro = new Date(ano!, mes! - 1, 1);
    const offset = (1 - (primeiro.getDay() === 0 ? 7 : primeiro.getDay()) + 7) % 7;
    const primeiraSegunda = `${mesAlvo()}-${String(1 + offset).padStart(2, '0')}`;
    expect(salvo.turnos).toContainEqual({ data: primeiraSegunda, janela: 'dia', medico: 'Mariana' });
    // e chegou no calendário
    expect(screen.getByRole('button', { name: 'salvar e visualizar o mês ›' })).toBeTruthy();
  });

  test('checkbox desmarcado abre o calendário limpo', () => {
    mockDesktop();
    const { onSalvar } = montar();
    abrirCalendario();
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-01` })).toBeTruthy();
  });

  test('escala já começada aparece pra continuar e vai direto pro calendário', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    fireEvent.click(screen.getByRole('button', { name: /HCB · .+ · 1 turnos/ }));
    expect(screen.getByRole('button', { name: 'salvar e visualizar o mês ›' })).toBeTruthy();
  });
});

describe('EscalaEquipe · etapa 2 (calendário)', () => {
  test('barra compacta mostra hospital, mês e turnos · clica pra voltar ao setup', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    abrirCalendario();
    const barra = screen.getByTitle('mudar hospital, mês ou turnos');
    expect(barra.textContent).toContain('HCB');
    expect(barra.textContent).toContain('dia · noite');
    fireEvent.click(barra);
    expect(screen.getByText('qual mês vamos montar?')).toBeTruthy();
  });

  test('equipe começa colapsada e expande no clique', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    abrirCalendario();
    const toggle = screen.getByRole('button', { name: 'expandir a equipe' });
    expect(toggle.textContent).toContain('equipe · 2');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'diminuir a equipe' })).toBeTruthy();
  });

  test('selecionar médico e clicar num turno escala · clicar no chip escalado remove', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    abrirCalendario();
    fireEvent.click(within(roster()).getByRole('button', { name: 'Paula' }));
    fireEvent.click(screen.getByRole('button', { name: `turno noite de ${mesAlvo()}-12` }));
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.turnos).toContainEqual({ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' });

    const slot = screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-10` });
    fireEvent.click(within(slot).getByRole('button', { name: /Mariana/ }));
    const salvo2 = onSalvar.mock.calls[1]![0] as EscalaEquipeT;
    expect(salvo2.turnos).toEqual([{ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' }]);
  });

  test('desfazer e refazer com os botões de ícone', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    abrirCalendario();
    fireEvent.click(within(roster()).getByRole('button', { name: 'Paula' }));
    fireEvent.click(screen.getByRole('button', { name: `turno noite de ${mesAlvo()}-12` }));
    fireEvent.click(screen.getByRole('button', { name: 'desfazer' }));
    const desfeito = onSalvar.mock.calls[1]![0] as EscalaEquipeT;
    expect(desfeito.turnos).toEqual([{ data: `${mesAlvo()}-10`, janela: 'dia', medico: 'Mariana' }]);
    fireEvent.click(screen.getByRole('button', { name: 'refazer' }));
    const refeito = onSalvar.mock.calls[2]![0] as EscalaEquipeT;
    expect(refeito.turnos).toContainEqual({ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' });
    expect(screen.getByText(/refeito · escalou Paula/)).toBeTruthy();
  });

  test('obs do dia salva no blur', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    abrirCalendario();
    const campo = screen.getByLabelText(`observação de ${mesAlvo()}-10`);
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: '* Mariana até 13h' } });
    expect(onSalvar).not.toHaveBeenCalled();
    fireEvent.blur(campo);
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.obs).toEqual({ [`${mesAlvo()}-10`]: '* Mariana até 13h' });
  });

  test('adicionar médico pelo input com enter', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    abrirCalendario();
    const input = screen.getByPlaceholderText('+ nome · enter');
    fireEvent.change(input, { target: { value: 'Rafael' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((onSalvar.mock.calls[0]![0] as EscalaEquipeT).medicos).toContain('Rafael');
  });

  test('sem turnos o botão de visualizar fica desabilitado', () => {
    mockDesktop();
    montar([{ ...rascunhoComEquipe(), turnos: [] }]);
    abrirCalendario();
    const btn = screen.getByRole('button', { name: 'salvar e visualizar o mês ›' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('EscalaEquipe · etapas 3 e 4 (visualizar e exportar)', () => {
  function irAteRevisar(): void {
    abrirCalendario();
    fireEvent.click(screen.getByRole('button', { name: 'salvar e visualizar o mês ›' }));
  }

  test('visualizar mostra a tabela do mês com os nomes', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    irAteRevisar();
    expect(screen.getByText('o mês inteiro, de uma olhada.')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Mariana')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '‹ voltar pro calendário' }));
    expect(screen.getByRole('button', { name: 'salvar e visualizar o mês ›' })).toBeTruthy();
  });

  test('exportar é a etapa seguinte · txt por médico usa o nome no arquivo', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    irAteRevisar();
    fireEvent.click(screen.getByRole('button', { name: 'exportar ›' }));
    expect(screen.getByText('agora manda.')).toBeTruthy();

    const bloco = screen.getByText('um pra cada médico').parentElement!;
    fireEvent.click(within(bloco).getAllByRole('button', { name: 'txt' })[0]!);
    expect(textoEquipeMedico).toHaveBeenCalledWith(expect.anything(), 'Mariana');
    expect(baixarArquivoTexto).toHaveBeenCalledWith(`escala-hcb-${mesAlvo()}-mariana.txt`, 'texto');
  });

  test('volta de exportar pra visualizar', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    irAteRevisar();
    fireEvent.click(screen.getByRole('button', { name: 'exportar ›' }));
    fireEvent.click(screen.getByRole('button', { name: '‹ voltar pra ver o mês' }));
    expect(screen.getByText('o mês inteiro, de uma olhada.')).toBeTruthy();
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
