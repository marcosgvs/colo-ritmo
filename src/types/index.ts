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

export interface Janela {
  /** Rótulo curto pra UI ("manhã", "tarde 1", "noitinha", "noite"). */
  rotulo: string;
  /** Hora decimal de início (7 = 07:00, 19.5 = 19:30). */
  inicio: number;
  /** Duração em horas. */
  duracao: number;
}

/**
 * Regras de um hospital específico · todas opcionais. Cada hospital tem
 * suas regras próprias · não dá pra herdar/reusar de outros. Esses dados
 * vão alimentar o Montar AI como contexto · não disparam comportamento
 * em runtime.
 */
export interface RegrasHospital {
  /** Quantidade máxima de plantões na semana. */
  maxPorSemana?: number;
  /** Quantidade máxima de plantões no mês. */
  maxPorMes?: number;
  /** Mínimo de fins-de-semana com plantão por mês (obrigação). */
  minFimDeSemana?: number;
  /** Máximo de fins-de-semana com plantão por mês. */
  maxFimDeSemana?: number;
  /** Mínimo de horas/semana exigidas pelo contrato (CLT). */
  minHorasPorSemana?: number;
  /** Máximo de horas/semana permitidas. */
  maxHorasPorSemana?: number;
  /** Mínimo de horas/mês exigidas pelo contrato. */
  minHorasPorMes?: number;
  /** Máximo de horas/mês permitidas. */
  maxHorasPorMes?: number;
  /** Duração padrão de um plantão. */
  duracaoPlantao?: number;
  /** Total máximo de horas combinadas num único dia (ex: tarde+noite). */
  duracaoMaximaDia?: number;
  /** Multiplicador de pagamento em feriado (1.0 = sem bônus, 2.0 = dobro). */
  feriadoMultiplicador?: number;
  /** Multiplicador adicional pra plantão de FDS (1.0 = sem bônus, 1.3 = +30%). */
  bonusFimDeSemana?: number;
  /** Regras que não casam com nenhum campo estruturado · texto livre. */
  regrasLivres?: string[];
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
  /** @deprecated não usado mais na UI · mantido opcional pra dados antigos */
  setores?: string[];
  regras: RegrasHospital;
  /** Janelas reais detectadas/cadastradas (ex: HSLz tem 5: manhã, tarde 1+2, noitinha, noite). */
  janelas?: Janela[];
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
  /** @deprecated não usado mais na UI · mantido opcional pra dados antigos */
  setor?: string;
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


/**
 * Uma célula da escala oficial · todos os médicos que aparecem juntos
 * num turno específico de um dia específico. Guardamos a transcrição
 * completa pra alimentar futuramente o "padrão do chefe".
 */
export interface CelulaEscala {
  /** YYYY-MM-DD. */
  data: string;
  /** Rótulo do turno como aparece no PDF (manhã, tarde, tarde 1, noitinha, noite, etc). */
  turno: string;
  /** Nomes EXATAMENTE como vêm na célula, na ordem em que aparecem. */
  nomes: string[];
}

/**
 * Transcrição completa de um PDF de escala importado · guardada pra
 * análise posterior (padrão do chefe, etc). Repositório passivo hoje.
 *
 * Re-importar substitui a entrada anterior do mesmo (hospital, ano, mes).
 */
export interface EscalaImportada {
  hospitalId: string;
  ano: number;
  /** 1-12. */
  mes: number;
  importadaEm: string;
  janelas: Janela[];
  celulas: CelulaEscala[];
}
