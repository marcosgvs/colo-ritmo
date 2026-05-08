/**
 * Helpers para o histórico de propostas do Montar.
 *
 * Cada proposta é um snapshot do que a médica enviou pro chefe.
 * `salvarProposta` faz upsert por id; `registrarChefe` é chamado em cada
 * exportação pra acumular nome do chefe usado por hospital.
 *
 * Limite de 10 propostas (FIFO) — ver MAX_PROPOSTAS.
 */

import type { BlocoPlantao, LenteProposta, PropostaSalva } from '@/types';

export const MAX_PROPOSTAS = 10;

export interface DadosProposta {
  id?: string;
  mesISO: string;
  hospitaisIncluidos: string[];
  metaUsada: number;
  bloqueioIds: (string | number)[];
  lente: LenteProposta;
  blocos: BlocoPlantao[];
}

export function novoIdProposta(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Cria ou atualiza uma proposta. Se `dados.id` está em `lista`, atualiza
 * preservando `criadaEm` e `exportadaParaChefes`. Caso contrário, cria nova.
 *
 * Marca `exportadaEm` se ainda não existir (primeira exportação).
 *
 * Aplica FIFO de 10 — sempre ordena por mais recente primeiro (createOrUpdate
 * timestamp → exportadaEm ?? criadaEm).
 */
export function salvarProposta(
  lista: PropostaSalva[],
  dados: DadosProposta,
): { proposta: PropostaSalva; lista: PropostaSalva[] } {
  const agora = new Date().toISOString();
  const id = dados.id ?? novoIdProposta();
  const existente = lista.find((p) => p.id === id);

  const proposta: PropostaSalva = existente
    ? {
        ...existente,
        mesISO: dados.mesISO,
        hospitaisIncluidos: dados.hospitaisIncluidos,
        metaUsada: dados.metaUsada,
        bloqueioIds: dados.bloqueioIds,
        lente: dados.lente,
        blocos: dados.blocos.map((b) => ({ ...b })),
        exportadaEm: existente.exportadaEm ?? agora,
      }
    : {
        id,
        mesISO: dados.mesISO,
        hospitaisIncluidos: dados.hospitaisIncluidos,
        metaUsada: dados.metaUsada,
        bloqueioIds: dados.bloqueioIds,
        lente: dados.lente,
        blocos: dados.blocos.map((b) => ({ ...b })),
        criadaEm: agora,
        exportadaEm: agora,
      };

  const semEsta = lista.filter((p) => p.id !== id);
  const proxima = [proposta, ...semEsta]
    .sort((a, b) => {
      const ta = a.exportadaEm ?? a.criadaEm;
      const tb = b.exportadaEm ?? b.criadaEm;
      return tb.localeCompare(ta);
    })
    .slice(0, MAX_PROPOSTAS);

  return { proposta, lista: proxima };
}

/** Registra o nome do chefe usado pra um hospital nessa proposta. */
export function registrarChefe(
  lista: PropostaSalva[],
  propostaId: string,
  hospitalId: string,
  nomeChefe: string,
): PropostaSalva[] {
  return lista.map((p) => {
    if (p.id !== propostaId) return p;
    const map = { ...(p.exportadaParaChefes ?? {}), [hospitalId]: nomeChefe };
    return { ...p, exportadaParaChefes: map };
  });
}

export function removerProposta(lista: PropostaSalva[], id: string): PropostaSalva[] {
  return lista.filter((p) => p.id !== id);
}

export function acharPropostaPorId(
  lista: PropostaSalva[],
  id: string,
): PropostaSalva | null {
  return lista.find((p) => p.id === id) ?? null;
}
