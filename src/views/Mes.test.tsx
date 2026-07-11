// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Bloco, Hospital, HospitaisMap } from '@/types';
import { HOJE, setHospitaisRuntime } from '@/lib/data';
import { Mes } from './Mes';

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
};

const HOSPITAIS: HospitaisMap = { HCB };
setHospitaisRuntime(HOSPITAIS);

/** Dia N do mês de HOJE em ISO · dias 7-21 não colidem com os vizinhos
 * do mês anterior/seguinte que aparecem na grade. */
function d(dia: number): string {
  return `${HOJE.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
}

const BLOCOS: Bloco[] = [
  { id: 1, tipo: 'plantao', hospitalId: 'HCB', data: d(14), horaInicio: 7, duracao: 12 },
  { id: 2, tipo: 'bloqueio', data: d(15), horaInicio: 0, duracao: 24, motivo: 'viagem' },
];

function mockViewport(mobile: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: mobile,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}

function montar() {
  const onSelectBloco = vi.fn();
  render(<Mes blocos={BLOCOS} hospitais={HOSPITAIS} onSelectBloco={onSelectBloco} />);
  return { onSelectBloco };
}

function painel(): HTMLElement {
  return screen.getByRole('region', { name: 'detalhe do dia' });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Mes · mobile (grade compacta + painel do dia)', () => {
  test('abre com hoje selecionado e painel visível', () => {
    mockViewport(true);
    montar();
    const dia = parseInt(HOJE.slice(8), 10);
    expect(
      screen.getAllByRole('button', { name: `dia ${dia}` }).some(
        (b) => b.getAttribute('aria-pressed') === 'true',
      ),
    ).toBe(true);
    expect(painel()).toBeTruthy();
  });

  test('tocar num dia com plantão lista o bloco · tocar no bloco abre o drawer', () => {
    mockViewport(true);
    const { onSelectBloco } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'dia 14' }));
    const linha = within(painel()).getByRole('button', { name: /HCB · plantão/ });
    fireEvent.click(linha);
    expect(onSelectBloco).toHaveBeenCalledTimes(1);
    expect((onSelectBloco.mock.calls[0]![0] as Bloco).id).toBe(1);
  });

  test('folga de dia inteiro lê "o dia inteiro"', () => {
    mockViewport(true);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'dia 15' }));
    expect(within(painel()).getByText(/folga · viagem/)).toBeTruthy();
    expect(within(painel()).getByText('o dia inteiro')).toBeTruthy();
  });

  test('dia vazio mostra "dia livre · respira"', () => {
    mockViewport(true);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'dia 20' }));
    expect(within(painel()).getByText('dia livre · respira')).toBeTruthy();
  });
});

describe('Mes · desktop (grade com chips, sem painel)', () => {
  test('mantém os chips de plantão e não renderiza o painel do dia', () => {
    mockViewport(false);
    montar();
    expect(screen.getByRole('button', { name: /HCB · 12h/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'detalhe do dia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'dia 14' })).toBeNull();
  });
});
