import { describe, expect, test } from 'vitest';
import type { BlocoPlantao, PropostaSalva } from '@/types';
import {
  MAX_PROPOSTAS,
  acharPropostaPorId,
  registrarChefe,
  removerProposta,
  salvarProposta,
} from './propostas.js';

const blocoExemplo = (id: string): BlocoPlantao => ({
  id,
  tipo: 'plantao',
  hospitalId: 'HSL',
  data: '2026-07-15',
  horaInicio: 7,
  duracao: 12,
  setor: 'enfermaria',
});

const dadosBase = () => ({
  mesISO: '2026-07',
  hospitaisIncluidos: ['HSL'],
  metaUsada: 22000,
  bloqueioIds: [],
  lente: 'equilibrar' as const,
  blocos: [blocoExemplo('a')],
});

describe('salvarProposta', () => {
  test('cria proposta nova quando id não existe', () => {
    const { proposta, lista } = salvarProposta([], dadosBase());
    expect(lista).toHaveLength(1);
    expect(proposta.id).toMatch(/^prop-/);
    expect(proposta.criadaEm).toBeTruthy();
    expect(proposta.exportadaEm).toBe(proposta.criadaEm);
    expect(proposta.blocos).toHaveLength(1);
  });

  test('atualiza proposta existente preservando criadaEm', async () => {
    const { proposta: p1, lista: l1 } = salvarProposta([], dadosBase());
    await new Promise((r) => setTimeout(r, 5));
    const { proposta: p2, lista: l2 } = salvarProposta(l1, {
      ...dadosBase(),
      id: p1.id,
      blocos: [blocoExemplo('a'), blocoExemplo('b')],
    });
    expect(l2).toHaveLength(1);
    expect(p2.id).toBe(p1.id);
    expect(p2.criadaEm).toBe(p1.criadaEm);
    expect(p2.exportadaEm).toBe(p1.exportadaEm); // preserva primeira exportação
    expect(p2.blocos).toHaveLength(2);
  });

  test('clona blocos pra evitar mutação externa', () => {
    const blocos = [blocoExemplo('a')];
    const { proposta } = salvarProposta([], { ...dadosBase(), blocos });
    blocos[0]!.duracao = 999;
    expect(proposta.blocos[0]!.duracao).toBe(12);
  });

  test('aplica limite FIFO de 10 propostas', () => {
    let lista: PropostaSalva[] = [];
    for (let i = 0; i < MAX_PROPOSTAS + 3; i++) {
      const { lista: nova } = salvarProposta(lista, {
        ...dadosBase(),
        mesISO: `2026-${String((i % 12) + 1).padStart(2, '0')}`,
      });
      lista = nova;
    }
    expect(lista).toHaveLength(MAX_PROPOSTAS);
  });

  test('ordena por exportadaEm desc', async () => {
    const { lista: l1 } = salvarProposta([], { ...dadosBase(), mesISO: '2026-01' });
    await new Promise((r) => setTimeout(r, 5));
    const { lista: l2 } = salvarProposta(l1, { ...dadosBase(), mesISO: '2026-02' });
    await new Promise((r) => setTimeout(r, 5));
    const { lista: l3 } = salvarProposta(l2, { ...dadosBase(), mesISO: '2026-03' });
    expect(l3.map((p) => p.mesISO)).toEqual(['2026-03', '2026-02', '2026-01']);
  });
});

describe('registrarChefe', () => {
  test('adiciona nome do chefe à proposta certa', () => {
    const { proposta, lista } = salvarProposta([], dadosBase());
    const atualizada = registrarChefe(lista, proposta.id, 'HSL', 'Dr. Roberto');
    expect(atualizada[0]!.exportadaParaChefes).toEqual({ HSL: 'Dr. Roberto' });
  });

  test('mantém chefes anteriores ao registrar novo', () => {
    const { proposta, lista } = salvarProposta([], dadosBase());
    const l1 = registrarChefe(lista, proposta.id, 'HSL', 'Dr. A');
    const l2 = registrarChefe(l1, proposta.id, 'HBDF', 'Dr. B');
    expect(l2[0]!.exportadaParaChefes).toEqual({ HSL: 'Dr. A', HBDF: 'Dr. B' });
  });

  test('ignora id que não existe', () => {
    const { lista } = salvarProposta([], dadosBase());
    const atualizada = registrarChefe(lista, 'fantasma', 'HSL', 'X');
    expect(atualizada).toEqual(lista);
  });
});

describe('removerProposta e acharPropostaPorId', () => {
  test('remove por id', () => {
    const { proposta, lista } = salvarProposta([], dadosBase());
    const depois = removerProposta(lista, proposta.id);
    expect(depois).toHaveLength(0);
  });

  test('acha por id', () => {
    const { proposta, lista } = salvarProposta([], dadosBase());
    expect(acharPropostaPorId(lista, proposta.id)?.id).toBe(proposta.id);
    expect(acharPropostaPorId(lista, 'fantasma')).toBeNull();
  });
});
