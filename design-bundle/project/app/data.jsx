// =====================================================================
// data.jsx — Colo Ritmo · domínio (hospitais, blocos, semanas)
// =====================================================================

const HOSPITAIS = {
  HSL:  {
    id: 'HSL',  nome: 'Hospital Santa Lúcia',         abrev: 'HSL',  cor: 'sand',
    tipo: 'privado',
    valorPlantao: 1800,  // calculado p/ compatibilidade · 12h × valorHora
    valorHora: 150,      // R$/h base diurno
    adicionalNoite: 200, // R$ a mais por plantão noturno
    setores: ['enfermaria', 'pronto-atendimento', 'noite'],
    regras: {
      maxPorSemana: 2,        // máx de plantões/semana
      minFimDeSemana: 1,      // pelo menos 1 fim de semana / mês
      intervaloMinHoras: 11,  // descanso mínimo entre plantões
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      // legado:
      maxPorMes: 8,
    },
  },
  HBDF: {
    id: 'HBDF', nome: 'Hospital de Base do DF',       abrev: 'HBDF', cor: 'blue',
    tipo: 'publico',
    valorPlantao: 1800,    // valor fixo do plantão (público)
    valorFixo: 1800,       // R$ por plantão (independente de horas)
    adicionalNoite: 250,   // R$ a mais quando noturno
    setores: ['UTI Pediátrica', 'enfermaria', 'PS'],
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 2,
      intervaloMinHoras: 12,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00', '13:00–19:00'],
      maxPorMes: 10,
    },
  },
  HDS:  {
    id: 'HDS',  nome: 'Hospital DF Star',             abrev: 'HDS',  cor: 'coral',
    tipo: 'privado',
    valorPlantao: 2400,
    valorHora: 200,
    adicionalNoite: 250,
    setores: ['PS pediátrico', 'enfermaria'],
    regras: {
      maxPorSemana: 1,
      minFimDeSemana: 0,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      maxPorMes: 6,
    },
  },
  HCB:  {
    id: 'HCB',  nome: 'Hospital da Criança',          abrev: 'HCB',  cor: 'aqua',
    tipo: 'publico',
    valorPlantao: 1600,
    valorFixo: 1600,
    adicionalNoite: 200,
    setores: ['pronto-atendimento', 'enfermaria', 'UTI'],
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 1,
      intervaloMinHoras: 11,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      maxPorMes: 8,
    },
  },
};

// Preferências da médica logada (Mariana)
const PREFERENCIAS_ME = {
  nome: 'Dra. Mariana',
  metaMensal: 22000,        // R$
  diasPreferidos: ['ter', 'qua', 'qui'],
  diasEvitar: ['dom'],
  hospitaisPreferidos: ['HBDF', 'HCB'],
  evitar24hCorrido: true,
  maxPlantoesPorSemana: 4,
  janelaPreferida: 'dia',   // 'dia' | 'noite' | 'ambos'
};

// Cor → CSS vars
function corTokens(c) {
  return {
    surface: `var(--${c}-surface)`,
    accent:  `var(--${c})`,
    ink:     `var(--${c}-ink)`,
  };
}

// Dia da semana BR — 0 = Seg, 6 = Dom
function diaSemanaBR(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  // JS getDay: 0=Sun..6=Sat → BR: 0=Seg..6=Dom
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

const DOWS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const DOWS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${DOWS[diaSemanaBR(iso)]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
function fmtHora(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}
function fmtRange(inicio, dur) {
  const fim = (inicio + dur) % 24;
  return `${fmtHora(inicio)} → ${fmtHora(fim)}`;
}

// Datas da semana 4-10 mai 2026 (segunda a domingo)
const SEMANA = ['2026-05-04','2026-05-05','2026-05-06','2026-05-07','2026-05-08','2026-05-09','2026-05-10'];

// === Vários "estados de dados" para tweak ===

// Limpa: 32h, sem conflito
const BLOCOS_LIMPA = [
  { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7, duracao: 6, setor: 'UTI Pediátrica' },
  { id: 2, tipo: 'sono',                          data: '2026-05-04', horaInicio: 14, duracao: 12 },
  { id: 3, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-06', horaInicio: 13, duracao: 6, setor: 'enfermaria' },
  { id: 4, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-09', horaInicio: 7, duracao: 12, setor: 'pronto-atendimento' },
  { id: 5, tipo: 'bloqueio',                       data: '2026-05-10', horaInicio: 0, duracao: 24, motivo: 'descanso' },
];

// Cheia: 48h, troca, cedido, deslocamento
const BLOCOS_CHEIA = [
  { id: 1, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-04', horaInicio: 7,  duracao: 6,  setor: 'enfermaria' },
  { id: 2, tipo: 'deslocamento', data: '2026-05-04', horaInicio: 13, duracao: 0.5, de: 'HSL', para: 'HCB', auto: true },
  { id: 3, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-04', horaInicio: 19, duracao: 12, setor: 'pronto-atendimento' },
  { id: 4, tipo: 'sono',                          data: '2026-05-05', horaInicio: 8,  duracao: 8 },
  { id: 5, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-06', horaInicio: 13, duracao: 6,  setor: 'UTI Pediátrica' },
  { id: 6, tipo: 'cedido',  hospitalId: 'HSL',  data: '2026-05-07', horaInicio: 7,  duracao: 6,  cedidoPara: 'Dra. Ana', motivo: 'aniversário do filho' },
  { id: 7, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-08', horaInicio: 19, duracao: 12, setor: 'noite', viaTroca: true, trocaInfo: 'Dr. João · HBDF sex' },
  { id: 8, tipo: 'bloqueio',                       data: '2026-05-09', horaInicio: 0,  duracao: 24, motivo: 'aniversário Mariana' },
  { id: 9, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-10', horaInicio: 7,  duracao: 12, setor: 'pronto-atendimento' },
];

// Conflito: dois blocos sobrepostos
const BLOCOS_CONFLITO = [
  ...BLOCOS_CHEIA.slice(0, 5),
  { id: 10, tipo: 'plantao', hospitalId: 'HDS',  data: '2026-05-06', horaInicio: 17, duracao: 6, setor: 'PS pediátrico', conflito: true },
  { id: 11, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-08', horaInicio: 13, duracao: 12, setor: 'UTI', conflito: true },
  { id: 12, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-08', horaInicio: 19, duracao: 12, setor: 'enfermaria', conflito: true },
  { id: 13, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-10', horaInicio: 7,  duracao: 12, setor: 'pronto' },
];

// 60h+ — alerta CFM
const BLOCOS_LIMITE = [
  { id: 1, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-04', horaInicio: 7,  duracao: 12, setor: 'UTI' },
  { id: 2, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-05', horaInicio: 7,  duracao: 12, setor: 'enf' },
  { id: 3, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-06', horaInicio: 19, duracao: 12, setor: 'PA' },
  { id: 4, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-08', horaInicio: 7,  duracao: 12, setor: 'UTI' },
  { id: 5, tipo: 'plantao', hospitalId: 'HDS',  data: '2026-05-09', horaInicio: 19, duracao: 12, setor: 'PS' },
  { id: 6, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-10', horaInicio: 7,  duracao: 6,  setor: 'enf' },
];

const ESTADOS = {
  cheia:    BLOCOS_CHEIA,
  limpa:    BLOCOS_LIMPA,
  conflito: BLOCOS_CONFLITO,
  limite:   BLOCOS_LIMITE,
};

function cargaSemanal(blocos) {
  return blocos.reduce((s, b) => {
    if (b.tipo === 'plantao') return s + b.duracao;
    return s;
  }, 0);
}

function nivelCarga(h) {
  if (h < 40) return 'ok';
  if (h < 60) return 'warn';
  return 'err';
}

// =====================================================================
// TIME / EQUIPE — perfis, vínculos e carga semanal
// =====================================================================

const TIME = [
  {
    id: 'carla',  nome: 'Dra. Carla Mendes',     iniciais: 'CM',
    titulo: 'Pediatra · UTI Pediátrica',
    hospitais: ['HBDF', 'HSL', 'HCB'],
    cargaSemana: 48, nivel: 'warn',
    tendencia: 'subindo',
    proximo: { hospital: 'HCB', data: '2026-05-09', hora: '07:00', setor: 'PA' },
    pendencias: 2,  // trocas para aprovar / conflitos
    isMe: true,
  },
  {
    id: 'ana',    nome: 'Dra. Ana Soares',       iniciais: 'AS',
    titulo: 'Pediatra · enfermaria',
    hospitais: ['HSL'],
    cargaSemana: 36, nivel: 'ok',
    tendencia: 'estavel',
    proximo: { hospital: 'HSL', data: '2026-05-07', hora: '07:00', setor: 'enfermaria' },
    pendencias: 0,
  },
  {
    id: 'joao',   nome: 'Dr. João Pereira',      iniciais: 'JP',
    titulo: 'Pediatra · noite',
    hospitais: ['HBDF', 'HSL'],
    cargaSemana: 60, nivel: 'err',
    tendencia: 'subindo',
    proximo: { hospital: 'HBDF', data: '2026-05-08', hora: '19:00', setor: 'UTI' },
    pendencias: 3,
  },
  {
    id: 'silvia', nome: 'Dra. Sílvia Tavares',   iniciais: 'ST',
    titulo: 'Coordenadora · Pediatria HBDF',
    hospitais: ['HBDF'],
    cargaSemana: 24, nivel: 'ok',
    tendencia: 'estavel',
    proximo: { hospital: 'HBDF', data: '2026-05-06', hora: '13:00', setor: 'reunião' },
    pendencias: 0,
    role: 'admin',
  },
  {
    id: 'rafa',   nome: 'Dr. Rafael Lima',       iniciais: 'RL',
    titulo: 'Pediatra · PS',
    hospitais: ['HDS', 'HCB'],
    cargaSemana: 52, nivel: 'warn',
    tendencia: 'descendo',
    proximo: { hospital: 'HDS', data: '2026-05-10', hora: '19:00', setor: 'PS pediátrico' },
    pendencias: 1,
  },
  {
    id: 'bia',    nome: 'Dra. Beatriz Costa',    iniciais: 'BC',
    titulo: 'R3 · Pediatria',
    hospitais: ['HBDF'],
    cargaSemana: 40, nivel: 'ok',
    tendencia: 'estavel',
    proximo: { hospital: 'HBDF', data: '2026-05-05', hora: '07:00', setor: 'UTI' },
    pendencias: 0,
  },
  {
    id: 'helena', nome: 'Dra. Helena Vargas',    iniciais: 'HV',
    titulo: 'Pediatra · neo',
    hospitais: ['HSL', 'HCB'],
    cargaSemana: 16, nivel: 'ok',
    tendencia: 'descendo',
    proximo: null,  // de férias
    ferias: 'até 12 mai',
    pendencias: 0,
  },
  {
    id: 'pedro',  nome: 'Dr. Pedro Almeida',     iniciais: 'PA',
    titulo: 'R2 · Pediatria',
    hospitais: ['HCB'],
    cargaSemana: 44, nivel: 'warn',
    tendencia: 'estavel',
    proximo: { hospital: 'HCB', data: '2026-05-04', hora: '19:00', setor: 'PA' },
    pendencias: 0,
  },
];

// Solicitações pendentes (para admin / coordenador)
const PENDENCIAS = [
  { id: 'p1', tipo: 'troca',     de: 'joao',   para: 'rafa',  bloco: 'HBDF · sex 8 mai · 19h',  motivo: 'casamento da irmã' },
  { id: 'p2', tipo: 'cessao',    de: 'carla',  para: 'ana',   bloco: 'HSL · qui 7 mai · 7h',     motivo: 'aniversário do filho' },
  { id: 'p3', tipo: 'conflito',  de: 'rafa',   bloco: 'HDS + HCB · sáb 9 mai · 19h',             motivo: 'duplo agendamento detectado' },
  { id: 'p4', tipo: 'limite',    de: 'joao',   bloco: 'semana 11–17 mai',                         motivo: '64h previstas · acima do CFM' },
];

// Ritmo sample: cargas das 4 semanas do mês
const CARGA_MES = [
  { sem: '4–10 mai',  h: 48, nivel: 'warn' },
  { sem: '11–17 mai', h: 36, nivel: 'ok' },
  { sem: '18–24 mai', h: 64, nivel: 'err' },
  { sem: '25–31 mai', h: 32, nivel: 'ok' },
];

Object.assign(window, {
  HOSPITAIS, corTokens, diaSemanaBR, DOWS, DOWS_LONG, MESES,
  fmtDate, fmtHora, fmtRange, SEMANA, ESTADOS,
  cargaSemanal, nivelCarga, CARGA_MES,
  TIME, PENDENCIAS, PREFERENCIAS_ME,
});
