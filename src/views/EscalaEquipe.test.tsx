// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { EscalaEquipe as EscalaEquipeT, EscalaImportada, Hospital, HospitaisMap } from '@/types';
import { setHospitaisRuntime } from '@/lib/data';
import { EscalaEquipe } from './EscalaEquipe';

// jsPDF pesa e não roda em jsdom · o export é testado à parte (pdfEquipe.test)
vi.mock('@/lib/pdfEquipe', () => ({
  baixarPDFEquipeCompleto: vi.fn().mockResolvedValue(undefined),
  baixarPDFEquipeMedico: vi.fn().mockResolvedValue(undefined),
}));

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
    { rotulo: 'noite', inicio: 19, duracao: 12 },
  ],
};

const HOSPITAIS: HospitaisMap = { HCB };
setHospitaisRuntime(HOSPITAIS);

/** Mês que a view abre por default: o mês seguinte ao atual. */
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
    janelas: HCB.janelas!,
    turnos: [{ data: `${mesAlvo()}-10`, janela: 'dia', medico: 'Mariana' }],
    atualizadaEm: '',
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EscalaEquipe', () => {
  test('puxar equipe da escala importada popula o roster por frequência', () => {
    mockDesktop();
    const { onSalvar } = montar();
    fireEvent.click(screen.getByRole('button', { name: /puxar equipe da escala/ }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.medicos).toEqual(['Paula', 'Mariana']);
    expect(salvo.hospitalId).toBe('HCB');
    expect(salvo.mesISO).toBe(mesAlvo());
  });

  test('adicionar médico pelo input com enter', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    const input = screen.getByPlaceholderText('+ nome do médico · enter');
    fireEvent.change(input, { target: { value: 'Rafael' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.medicos).toContain('Rafael');
  });

  test('selecionar médico e clicar num turno escala · clicar no chip escalado remove', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    // seleciona a Paula no roster
    fireEvent.click(screen.getByRole('button', { name: 'Paula' }));
    // clica no turno noite do dia 12
    fireEvent.click(screen.getByRole('button', { name: `turno noite de ${mesAlvo()}-12` }));
    const salvo = onSalvar.mock.calls[0]![0] as EscalaEquipeT;
    expect(salvo.turnos).toContainEqual({ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' });

    // remover: chip da Mariana escalada no dia 10 · a Paula recém-escalada
    // sobrevive (o ref otimista acumula entre saves sem re-render)
    const slot = screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-10` });
    fireEvent.click(within(slot).getByRole('button', { name: /Mariana/ }));
    const salvo2 = onSalvar.mock.calls[1]![0] as EscalaEquipeT;
    expect(salvo2.turnos).toEqual([{ data: `${mesAlvo()}-12`, janela: 'noite', medico: 'Paula' }]);
  });

  test('status lateral mostra horas por médico (12h do turno dia)', () => {
    mockDesktop();
    montar([rascunhoComEquipe()]);
    const painel = screen.getByText('quem tá com quanto').closest('div')!.parentElement!;
    expect(within(painel).getByText('12h')).toBeTruthy();
  });

  test('duplicata exata não escala duas vezes', () => {
    mockDesktop();
    const { onSalvar } = montar([rascunhoComEquipe()]);
    // "Mariana" existe no roster E escalada no dia 10 · escopa pelo roster
    const roster = screen.getByText('equipe').parentElement!;
    fireEvent.click(within(roster).getByRole('button', { name: 'Mariana' }));
    fireEvent.click(screen.getByRole('button', { name: `turno dia de ${mesAlvo()}-10` }));
    expect(onSalvar).not.toHaveBeenCalled();
  });

  test('em mobile mostra o aviso de desktop', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    );
    montar();
    expect(screen.getByText('melhor no computador.')).toBeTruthy();
  });
});
