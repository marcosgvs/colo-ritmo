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
  /** Mínimo de horas/semana exigidas pelo contrato (CLT). */
  minHorasPorSemana?: number;
  /** Máximo de horas/semana permitidas. */
  maxHorasPorSemana?: number;
  /** Mínimo de horas/mês exigidas pelo contrato. */
  minHorasPorMes?: number;
  /** Máximo de horas/mês permitidas. */
  maxHorasPorMes?: number;
  /** Mínimo de horas de plantão em FDS por mês. */
  minHorasPorFimDeSemana?: number;
  /** Máximo de horas de plantão em FDS por mês. */
  maxHorasPorFimDeSemana?: number;
  /** Total máximo de horas combinadas num único dia (ex: tarde+noite = 18h). */
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
  hospitaisPreferidos: string[];
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
/**
 * Plantão sugerido pelo Montar · forma simplificada de Bloco usada nas
 * propostas (id próprio, sem campos de troca/conflito).
 */
export interface PlantaoSugerido {
  id: string;
  hospitalId: string;
  data: string;
  horaInicio: number;
  duracao: number;
  razao?: string;
}

/**
 * Snapshot de uma proposta gerada pelo Montar · histórico pra a médica
 * comparar tentativas (ex: rodou "equilibrar" e depois "acelerar +15%",
 * quer ver as duas lado a lado antes de escolher). Auto-limita a últimas
 * N entradas no useUserState.
 */
export interface PropostaHistorico {
  id: string;
  geradoEm: string;
  mes: string;
  lente: 'descansar' | 'equilibrar' | 'acelerar';
  acelerarPercentual?: number;
  acelerarValor?: number;
  hospitaisIds: string[];
  plantoes: PlantaoSugerido[];
  justificativa: string;
  valorEstimado: number;
  avisos: string[];
}

export interface EscalaImportada {
  hospitalId: string;
  ano: number;
  /** 1-12. */
  mes: number;
  importadaEm: string;
  janelas: Janela[];
  celulas: CelulaEscala[];
  /**
   * Apelido EXATO que a médica digitou no campo "seu nome na escala" no
   * momento desse import. Salvo por escala (não por hospital) porque o
   * chefe pode rebatizar entre meses (ex: chega outra Mariana Pinheiro
   * e o chefe muda a primeira pra "MariAraujo"). Sem isso não dá pra
   * extrair "padrão do chefe" das celulas com fuzzy match confiável.
   *
   * Opcional pra retrocompatibilidade · escalas antigas não têm.
   */
  apelidoUsado?: string;
}

/**
 * Escala da EQUIPE inteira de um hospital · página temporária onde a
 * chefe monta o mês de todo mundo (não só o dela). Um turno = um médico
 * escalado numa janela de um dia. Vive no user_state como as propostas.
 */
export interface TurnoEquipe {
  /** YYYY-MM-DD. */
  data: string;
  /** Rótulo da janela (bate com Janela.rotulo). */
  janela: string;
  /** Nome do médico exatamente como está no roster. */
  medico: string;
}

export interface EscalaEquipe {
  hospitalId: string;
  /** YYYY-MM. */
  mesISO: string;
  medicos: string[];
  janelas: Janela[];
  turnos: TurnoEquipe[];
  /** Observações por dia (data ISO → texto) · os "asteriscos" da escala oficial. */
  obs?: Record<string, string>;
  atualizadaEm: string;
}
