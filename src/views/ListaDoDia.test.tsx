// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListaDoDia } from './ListaDoDia';

afterEach(cleanup);

function montar() {
  const onSelectBloco = vi.fn();
  render(<ListaDoDia blocos={[]} hospitais={{}} onSelectBloco={onSelectBloco} />);
  return { onSelectBloco };
}

/** O botão "hoje" do header só existe quando a semana visível NÃO é a
 * atual · serve de sinal de que a virada de semana aconteceu. */
function estaNaSemanaAtual(): boolean {
  return screen.queryByRole('button', { name: 'hoje' }) === null;
}

function simularScrollAteOFim(): void {
  const regiao = screen.getByRole('region', { name: 'linha do tempo da semana' });
  // jsdom não faz layout · injeta a geometria de um scroll no fim
  Object.defineProperty(regiao, 'scrollHeight', { value: 3776, configurable: true });
  Object.defineProperty(regiao, 'clientHeight', { value: 700, configurable: true });
  fireEvent.scroll(regiao, { target: { scrollTop: 3076 } });
}

describe('ListaDoDia · virada automática de semana', () => {
  test('scroll até o fim da timeline vira pra próxima semana', () => {
    montar();
    expect(estaNaSemanaAtual()).toBe(true);
    simularScrollAteOFim();
    expect(estaNaSemanaAtual()).toBe(false);
  });

  test('scroll no meio da timeline não vira', () => {
    montar();
    const regiao = screen.getByRole('region', { name: 'linha do tempo da semana' });
    Object.defineProperty(regiao, 'scrollHeight', { value: 3776, configurable: true });
    Object.defineProperty(regiao, 'clientHeight', { value: 700, configurable: true });
    fireEvent.scroll(regiao, { target: { scrollTop: 1500 } });
    expect(estaNaSemanaAtual()).toBe(true);
  });

  test('botão "próxima semana" no rodapé também vira', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /próxima semana/ }));
    expect(estaNaSemanaAtual()).toBe(false);
  });

  test('depois de virar, o botão "hoje" traz de volta pra semana atual', () => {
    montar();
    simularScrollAteOFim();
    fireEvent.click(screen.getByRole('button', { name: 'hoje' }));
    expect(estaNaSemanaAtual()).toBe(true);
  });
});
