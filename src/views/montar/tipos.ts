// Tipos e constantes compartilhados do fluxo Montar (lentes, etapas, atividades).

import type { PlantaoSugerido, PropostaHistorico } from '@/types';

export const FRASES_MONTAR = [
  'lendo as regras de cada hospital',
  'olhando seu histórico',
  'checando o padrão do chefe',
  'respeitando seus bloqueios',
  'espaçando descanso entre plantões',
  'calculando se bate na meta',
  'ajustando a proposta final',
] as const;

export type Lente = 'descansar' | 'equilibrar' | 'acelerar';
export type Etapa = 'setup' | 'bloqueios' | 'gerando' | 'preview' | 'exportar';
export type TipoAtividade = 'bloqueio' | 'sono' | 'consulta' | 'estudo' | 'pessoal' | 'outros';

export const ETAPAS: Array<{ id: Etapa; label: string }> = [
  { id: 'setup', label: 'configurar' },
  { id: 'bloqueios', label: 'bloqueios' },
  { id: 'gerando', label: 'gerar' },
  { id: 'preview', label: 'editar' },
  { id: 'exportar', label: 'exportar' },
];

export interface PropostaResultado {
  plantoes: PlantaoSugerido[];
  justificativa: string;
  valorEstimado: number;
  avisos: string[];
  respostaCrua?: string;
}

export const LENTES: Array<{ id: Lente; titulo: string; recado: string }> = [
  { id: 'descansar', titulo: 'descansar', recado: 'menos plantões · espaçamento maior · prioriza descanso' },
  { id: 'equilibrar', titulo: 'equilibrar', recado: 'saudável dentro das regras · sem pressão extra' },
  { id: 'acelerar', titulo: 'acelerar', recado: 'mais perto do teto contratual · precisa de motivo' },
];

export const LABEL_LENTE: Record<PropostaHistorico['lente'], string> = {
  descansar: 'descansar',
  equilibrar: 'equilibrar',
  acelerar: 'acelerar',
};

export const TIPOS_ATIVIDADE: Array<{ id: TipoAtividade; label: string }> = [
  { id: 'bloqueio', label: 'bloqueio' },
  { id: 'sono', label: 'sono protegido' },
  { id: 'consulta', label: 'consulta' },
  { id: 'estudo', label: 'estudo' },
  { id: 'pessoal', label: 'pessoal' },
  { id: 'outros', label: 'outros' },
];
