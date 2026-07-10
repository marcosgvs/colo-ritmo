// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Bloco, Hospital, HospitaisMap } from '@/types';
import { setHospitaisRuntime } from '@/lib/data';
import { AdicionarBloco } from './AdicionarBloco';

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

function montar(props: Partial<Parameters<typeof AdicionarBloco>[0]> = {}) {
  const onSalvar = vi.fn();
  const onCancelar = vi.fn();
  render(
    <AdicionarBloco
      tipo={props.tipo ?? 'outros'}
      hospitais={props.hospitais ?? HOSPITAIS}
      blocosAtuais={props.blocosAtuais ?? []}
      dataInicial={props.dataInicial ?? '2026-07-10'}
      blocoExistente={props.blocoExistente}
      onSalvar={onSalvar}
      onRemover={props.onRemover}
      onCancelar={onCancelar}
    />,
  );
  return { onSalvar, onCancelar };
}

function salvar() {
  fireEvent.click(screen.getByRole('button', { name: /adicionar|salvar alterações/ }));
}

afterEach(cleanup);

describe('AdicionarBloco · plantão', () => {
  test('salva plantão com hospital, data e janela default', () => {
    const { onSalvar } = montar({ tipo: 'plantao' });
    salvar();
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b.tipo).toBe('plantao');
    expect(b).toMatchObject({ hospitalId: 'HCB', data: '2026-07-10', horaInicio: 7, duracao: 12 });
  });

  test('sem hospital cadastrado o botão fica desabilitado', () => {
    const { onSalvar } = montar({ tipo: 'plantao', hospitais: {} });
    const btn = screen.getByRole('button', { name: 'adicionar' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSalvar).not.toHaveBeenCalled();
  });
});

describe('AdicionarBloco · outro compromisso (chips)', () => {
  test('default é "outro" · descrição vira titulo', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.change(screen.getByPlaceholderText('reunião · jantar · etc'), {
      target: { value: 'jantar da residência' },
    });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'outros', titulo: 'jantar da residência', horaInicio: 19, duracao: 3 });
  });

  test('chip consulta · descrição vira local + janela default 9→13', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.click(screen.getByRole('button', { name: 'consulta' }));
    fireEvent.change(screen.getByPlaceholderText('consultório centro'), {
      target: { value: 'ambulatório asa sul' },
    });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'consulta', local: 'ambulatório asa sul', horaInicio: 9, duracao: 4 });
  });

  test('chip estudo · descrição vira titulo', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.click(screen.getByRole('button', { name: 'estudo' }));
    fireEvent.change(screen.getByPlaceholderText('curso de UTI neonatal'), {
      target: { value: 'congresso SBP' },
    });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'estudo', titulo: 'congresso SBP', horaInicio: 9, duracao: 8 });
  });

  test('chip pessoal · descrição vira titulo', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.click(screen.getByRole('button', { name: 'pessoal' }));
    fireEvent.change(screen.getByPlaceholderText('aniversário · família'), {
      target: { value: 'aniversário da vó' },
    });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'pessoal', titulo: 'aniversário da vó', horaInicio: 19, duracao: 3 });
  });

  test('chip folga · bloqueia o dia INTEIRO (0h→24h, não 19h escondidas)', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.click(screen.getByRole('button', { name: 'folga' }));
    fireEvent.change(screen.getByPlaceholderText('viagem · descanso'), {
      target: { value: 'viagem' },
    });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'bloqueio', motivo: 'viagem', horaInicio: 0, duracao: 24 });
  });

  test('chip sono · sem campo de descrição · janela 22→6', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    fireEvent.click(screen.getByRole('button', { name: 'sono' }));
    expect(screen.queryByText('o que é')).toBeNull();
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ tipo: 'sono', horaInicio: 22, duracao: 8 });
  });

  test('hora fim editada recalcula duração (cruza meia-noite)', () => {
    const { onSalvar } = montar({ tipo: 'outros' });
    // outro: 19→22 default · muda fim pra 2h = 7h de duração (overnight)
    fireEvent.change(screen.getByPlaceholderText('fim'), { target: { value: '2' } });
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({ horaInicio: 19, duracao: 7 });
  });
});

describe('AdicionarBloco · editar', () => {
  test('preserva id e chip pré-selecionado · trocar chip não reseta horas', () => {
    const existente: Bloco = {
      id: 'manual-123',
      tipo: 'consulta',
      data: '2026-07-15',
      horaInicio: 14,
      duracao: 2,
      local: 'consultório',
    };
    const { onSalvar } = montar({ tipo: 'consulta', blocoExistente: existente });
    const chipConsulta = screen.getByRole('button', { name: 'consulta' });
    expect(chipConsulta.getAttribute('aria-pressed')).toBe('true');
    // muda a identificação pra pessoal · horário editado se mantém
    fireEvent.click(screen.getByRole('button', { name: 'pessoal' }));
    salvar();
    const b = onSalvar.mock.calls[0]![0] as Bloco;
    expect(b).toMatchObject({
      id: 'manual-123',
      tipo: 'pessoal',
      data: '2026-07-15',
      horaInicio: 14,
      duracao: 2,
      titulo: 'consultório',
    });
  });

  test('remover aparece só em modo editar e dispara onRemover', () => {
    const onRemover = vi.fn();
    const existente: Bloco = {
      id: 7,
      tipo: 'bloqueio',
      data: '2026-07-15',
      horaInicio: 0,
      duracao: 24,
      motivo: 'viagem',
    };
    montar({ tipo: 'bloqueio', blocoExistente: existente, onRemover });
    fireEvent.click(screen.getByRole('button', { name: 'remover da agenda' }));
    expect(onRemover).toHaveBeenCalledTimes(1);
  });
});
