/**
 * Domínio do Colo Ritmo · tipos compartilhados.
 *
 * Os blocos representam tudo que ocupa tempo na agenda da médica:
 * plantão, sono protegido, bloqueios, cedidos, trocas, deslocamento e
 * compromissos universais (consulta, estudo, pessoal, outros).
 */

export type Mode = 'medica' | 'parceiro' | 'admin';

export type Nivel = 'ok' | 'warn' | 'err';

export type HandVariant = 'italic' | 'sans-italic' | 'plain' | 'handwritten';

export type CorFamilia =
  | 'sand'
  | 'coral'
  | 'sage'
  | 'olive'
  | 'lavender'
  | 'pink'
  | 'blue'
  | 'aqua';

export type TipoHospital = 'publico' | 'privado';

export interface RegrasHospital {
  maxPorSemana: number;
  minFimDeSemana: number;
  intervaloMinHoras: number;
  duracaoPlantao: number;
  janelas: string[];
  maxPorMes: number;
}

export interface EnderecoHospital {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  lat?: number;
  lng?: number;
}

export interface Hospital {
  id: string;
  nome: string;
  abrev: string;
  cor: CorFamilia;
  tipo: TipoHospital;
  valorPlantao: number;
  valorHora?: number;
  valorFixo?: number;
  adicionalNoite: number;
  setores: string[];
  regras: RegrasHospital;
  endereco?: EnderecoHospital;
}

export type HospitaisMap = Record<string, Hospital>;

export type SegmentoBloco = 'unico' | 'inicio' | 'fim';

export interface BlocoBase {
  id: number | string;
  data: string;
  horaInicio: number;
  duracao: number;
  /** Marcador do segmento gerado pela expansão de plantões noturnos. */
  _seg?: SegmentoBloco;
}

export interface BlocoPlantao extends BlocoBase {
  tipo: 'plantao';
  hospitalId: string;
  setor: string;
  viaTroca?: boolean;
  trocaInfo?: string;
  conflito?: boolean;
}

export interface BlocoCedido extends BlocoBase {
  tipo: 'cedido';
  hospitalId: string;
  cedidoPara: string;
  motivo?: string;
}

export interface BlocoTrocado extends BlocoBase {
  tipo: 'trocado';
  trocadoCom: string;
}

export interface BlocoSono extends BlocoBase {
  tipo: 'sono';
}

export interface BlocoBloqueio extends BlocoBase {
  tipo: 'bloqueio';
  motivo?: string;
}

export interface BlocoDeslocamento extends BlocoBase {
  tipo: 'deslocamento';
  de: string;
  para: string;
  auto?: boolean;
}

export interface BlocoConsulta extends BlocoBase {
  tipo: 'consulta';
  local?: string;
  detalhe?: string;
}

export interface BlocoEstudo extends BlocoBase {
  tipo: 'estudo';
  subtipo?: string;
  titulo?: string;
}

export interface BlocoPessoal extends BlocoBase {
  tipo: 'pessoal';
  titulo?: string;
}

export interface BlocoOutros extends BlocoBase {
  tipo: 'outros';
  categoria?: string;
  titulo?: string;
}

export type Bloco =
  | BlocoPlantao
  | BlocoCedido
  | BlocoTrocado
  | BlocoSono
  | BlocoBloqueio
  | BlocoDeslocamento
  | BlocoConsulta
  | BlocoEstudo
  | BlocoPessoal
  | BlocoOutros;

export interface Preferencias {
  nome: string;
  telefone?: string;
  metaMensal: number;
  diasPreferidos: string[];
  diasEvitar: string[];
  hospitaisPreferidos: string[];
  evitar24hCorrido: boolean;
  maxPlantoesPorSemana: number;
  janelaPreferida: 'dia' | 'noite' | 'ambos';
}

export interface CargaSemana {
  sem: string;
  h: number;
  nivel: Nivel;
}

export type LenteProposta = 'descansar' | 'equilibrar' | 'ganhar';

/**
 * Proposta salva no histórico do Montar.
 *
 * É um snapshot do que a médica enviou pro chefe — mês × hospitais ×
 * lente × blocos finais (após edição manual). Reabrir não roda solver
 * de novo; mostra exatamente o que foi enviado, com chance de re-exportar.
 *
 * `bloqueioIds` é informacional. Se o bloqueio sumiu da agenda, a proposta
 * reaberta simplesmente não tem ele — não tenta recriar.
 */
export interface PropostaSalva {
  id: string;
  mesISO: string;
  hospitaisIncluidos: string[];
  metaUsada: number;
  bloqueioIds: (string | number)[];
  lente: LenteProposta;
  blocos: BlocoPlantao[];
  criadaEm: string;
  exportadaEm?: string;
  exportadaParaChefes?: Record<string, string>;
}
