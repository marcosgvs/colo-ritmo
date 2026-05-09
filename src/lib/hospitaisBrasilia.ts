/**
 * Catálogo curado de hospitais de Brasília + entorno (DF/GO).
 *
 * Usado pelo autocomplete em `Hospitais.tsx` quando o usuário começa a
 * digitar o nome do hospital. Selecionar uma sugestão preenche nome,
 * abreviação sugerida, tipo, endereço e geo.
 *
 * Fonte: dados públicos · curado manualmente. Lat/lng são aproximadas
 * pelo polo urbano. CEP é incluído quando há confiança razoável; quando
 * em dúvida, fica vazio e o usuário busca via "buscar coordenadas".
 *
 * Esta lista é ponto de partida — o usuário ainda pode editar qualquer
 * campo após selecionar.
 */

import type { TipoHospital } from '@/types';

export interface SugestaoHospital {
  nome: string;
  abrev: string;
  tipo: TipoHospital;
  endereco: {
    cep?: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
    lat?: number;
    lng?: number;
  };
}

export const HOSPITAIS_BRASILIA: SugestaoHospital[] = [
  // ---- Públicos · DF (Plano Piloto e regiões administrativas) ----
  {
    nome: 'Hospital de Base do Distrito Federal',
    abrev: 'HBDF',
    tipo: 'publico',
    endereco: {
      cep: '70335-901',
      logradouro: 'SMHS Quadra 101, Conjunto A',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7991,
      lng: -47.8915,
    },
  },
  {
    nome: 'Hospital da Criança de Brasília José Alencar',
    abrev: 'HCB',
    tipo: 'publico',
    endereco: {
      cep: '70684-831',
      logradouro: 'AENW 3, Lote A',
      bairro: 'Setor de Áreas Especiais Noroeste',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7855,
      lng: -47.9094,
    },
  },
  {
    nome: 'Hospital Materno Infantil de Brasília',
    abrev: 'HMIB',
    tipo: 'publico',
    endereco: {
      cep: '70203-900',
      logradouro: 'SGAS 608, Módulo A',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8235,
      lng: -47.8908,
    },
  },
  {
    nome: 'Hospital Regional da Asa Norte',
    abrev: 'HRAN',
    tipo: 'publico',
    endereco: {
      cep: '70710-100',
      logradouro: 'SMHN Quadra 101',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7741,
      lng: -47.8826,
    },
  },
  {
    nome: 'Hospital Regional do Gama',
    abrev: 'HRG',
    tipo: 'publico',
    endereco: {
      cep: '72405-901',
      logradouro: 'Área Especial Quadra 1',
      bairro: 'Setor Central',
      cidade: 'Gama',
      uf: 'DF',
      lat: -16.0211,
      lng: -48.0656,
    },
  },
  {
    nome: 'Hospital Regional de Taguatinga',
    abrev: 'HRT',
    tipo: 'publico',
    endereco: {
      cep: '72115-540',
      logradouro: 'QNC Área Especial 24',
      bairro: 'Taguatinga Norte',
      cidade: 'Taguatinga',
      uf: 'DF',
      lat: -15.8307,
      lng: -48.0473,
    },
  },
  {
    nome: 'Hospital Regional de Ceilândia',
    abrev: 'HRC',
    tipo: 'publico',
    endereco: {
      cep: '72215-170',
      logradouro: 'QNM 17, Área Especial',
      bairro: 'Ceilândia Sul',
      cidade: 'Ceilândia',
      uf: 'DF',
      lat: -15.8196,
      lng: -48.1051,
    },
  },
  {
    nome: 'Hospital Regional de Sobradinho',
    abrev: 'HRS',
    tipo: 'publico',
    endereco: {
      cep: '73015-127',
      logradouro: 'Quadra 12, Área Especial',
      bairro: 'Sobradinho',
      cidade: 'Sobradinho',
      uf: 'DF',
      lat: -15.6517,
      lng: -47.7919,
    },
  },
  {
    nome: 'Hospital Regional de Planaltina',
    abrev: 'HRPL',
    tipo: 'publico',
    endereco: {
      cep: '73310-010',
      logradouro: 'Avenida NS-A, Área Especial 1',
      bairro: 'Setor Hospitalar',
      cidade: 'Planaltina',
      uf: 'DF',
      lat: -15.6212,
      lng: -47.6595,
    },
  },
  {
    nome: 'Hospital Regional de Brazlândia',
    abrev: 'HRBz',
    tipo: 'publico',
    endereco: {
      cep: '72720-140',
      logradouro: 'Área Especial 03, Setor Tradicional',
      bairro: 'Setor Tradicional',
      cidade: 'Brazlândia',
      uf: 'DF',
      lat: -15.6818,
      lng: -48.2014,
    },
  },
  {
    nome: 'Hospital Regional de Samambaia',
    abrev: 'HRSAM',
    tipo: 'publico',
    endereco: {
      cep: '72313-101',
      logradouro: 'QR 302, Conjunto 02, Área Especial',
      bairro: 'Samambaia Sul',
      cidade: 'Samambaia',
      uf: 'DF',
      lat: -15.8736,
      lng: -48.0814,
    },
  },
  {
    nome: 'Hospital Regional de Santa Maria',
    abrev: 'HRSM',
    tipo: 'publico',
    endereco: {
      cep: '72502-330',
      logradouro: 'AC 102, Bloco A',
      bairro: 'Santa Maria',
      cidade: 'Santa Maria',
      uf: 'DF',
      lat: -16.0316,
      lng: -48.0148,
    },
  },
  {
    nome: 'Hospital Regional do Paranoá',
    abrev: 'HRPa',
    tipo: 'publico',
    endereco: {
      cep: '71570-501',
      logradouro: 'Quadra 5, Conjunto A',
      bairro: 'Paranoá',
      cidade: 'Paranoá',
      uf: 'DF',
      lat: -15.7782,
      lng: -47.7787,
    },
  },
  {
    nome: 'Hospital Regional do Guará',
    abrev: 'HRGu',
    tipo: 'publico',
    endereco: {
      cep: '71010-014',
      logradouro: 'QE 01, Área Especial',
      bairro: 'Guará I',
      cidade: 'Guará',
      uf: 'DF',
      lat: -15.8285,
      lng: -47.9714,
    },
  },
  {
    nome: 'Hospital Universitário de Brasília',
    abrev: 'HUB',
    tipo: 'publico',
    endereco: {
      cep: '70840-901',
      logradouro: 'SGAN 605, Avenida L2 Norte',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7681,
      lng: -47.8743,
    },
  },
  {
    nome: 'Hospital das Forças Armadas',
    abrev: 'HFA',
    tipo: 'publico',
    endereco: {
      cep: '70658-900',
      logradouro: 'Estrada Contorno do Bosque',
      bairro: 'Cruzeiro Novo',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7906,
      lng: -47.9319,
    },
  },
  {
    nome: 'Hospital Militar de Área de Brasília',
    abrev: 'HMAB',
    tipo: 'publico',
    endereco: {
      cep: '70630-902',
      logradouro: 'Setor Militar Urbano',
      bairro: 'Setor Militar Urbano',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7872,
      lng: -47.9248,
    },
  },

  // ---- Privados · DF ----
  {
    nome: 'Hospital Santa Lúcia',
    abrev: 'HSL',
    tipo: 'privado',
    endereco: {
      cep: '70390-700',
      logradouro: 'SHLS 716, Conjunto C',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8336,
      lng: -47.9067,
    },
  },
  {
    nome: 'Hospital Santa Lúcia Norte',
    abrev: 'HSLN',
    tipo: 'privado',
    endereco: {
      cep: '70804-010',
      logradouro: 'SHCGN 506, Bloco A',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7659,
      lng: -47.8788,
    },
  },
  {
    nome: 'Hospital DF Star',
    abrev: 'HDS',
    tipo: 'privado',
    endereco: {
      cep: '70390-145',
      logradouro: 'SGAS 914, Conjunto F',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8259,
      lng: -47.9013,
    },
  },
  {
    nome: 'Hospital Santa Helena',
    abrev: 'HSH',
    tipo: 'privado',
    endereco: {
      cep: '71939-360',
      logradouro: 'Avenida das Castanheiras 1300',
      bairro: 'Águas Claras',
      cidade: 'Águas Claras',
      uf: 'DF',
      lat: -15.8340,
      lng: -48.0250,
    },
  },
  {
    nome: 'Hospital Brasília',
    abrev: 'HB',
    tipo: 'privado',
    endereco: {
      cep: '71916-500',
      logradouro: 'Avenida Pau Brasil 800, Lote 02',
      bairro: 'Águas Claras',
      cidade: 'Águas Claras',
      uf: 'DF',
      lat: -15.8378,
      lng: -48.0192,
    },
  },
  {
    nome: 'Hospital Anchieta',
    abrev: 'HA',
    tipo: 'privado',
    endereco: {
      cep: '71926-251',
      logradouro: 'QSAN, Pistão Sul',
      bairro: 'Taguatinga Sul',
      cidade: 'Taguatinga',
      uf: 'DF',
      lat: -15.8455,
      lng: -48.0354,
    },
  },
  {
    nome: 'Hospital Daher Lago Sul',
    abrev: 'HDL',
    tipo: 'privado',
    endereco: {
      cep: '71615-651',
      logradouro: 'SHIS QI 07, Conjunto E',
      bairro: 'Lago Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8432,
      lng: -47.8676,
    },
  },
  {
    nome: 'Hospital Santa Marta',
    abrev: 'HSM',
    tipo: 'privado',
    endereco: {
      cep: '72015-001',
      logradouro: 'QSC 01, Conjunto F',
      bairro: 'Taguatinga Sul',
      cidade: 'Taguatinga',
      uf: 'DF',
      lat: -15.8472,
      lng: -48.0421,
    },
  },
  {
    nome: 'Hospital Santa Luzia',
    abrev: 'HSLz',
    tipo: 'privado',
    endereco: {
      cep: '70390-902',
      logradouro: 'SHLS 716, Conjunto E',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8341,
      lng: -47.9075,
    },
  },
  {
    nome: 'Hospital São Mateus',
    abrev: 'HSMt',
    tipo: 'privado',
    endereco: {
      cep: '70390-148',
      logradouro: 'SGAS 915, Conjunto E',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8265,
      lng: -47.9009,
    },
  },
  {
    nome: 'Maternidade Brasília',
    abrev: 'MTB',
    tipo: 'privado',
    endereco: {
      cep: '70390-902',
      logradouro: 'SHLS 716, Bloco D',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8338,
      lng: -47.9079,
    },
  },
  {
    nome: 'Hospital Albert Sabin',
    abrev: 'HAS',
    tipo: 'privado',
    endereco: {
      cep: '71625-150',
      logradouro: 'SHIS QI 07, Lote 50',
      bairro: 'Lago Sul',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.8463,
      lng: -47.8654,
    },
  },
  {
    nome: 'Hospital Dia e Maternidade Brasília',
    abrev: 'HDMB',
    tipo: 'privado',
    endereco: {
      cep: '70710-900',
      logradouro: 'SMHN Quadra 02, Bloco A',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      lat: -15.7748,
      lng: -47.8819,
    },
  },
  {
    nome: 'Hospital Pacini',
    abrev: 'HP',
    tipo: 'privado',
    endereco: {
      cep: '72015-625',
      logradouro: 'QNC 02, Lotes 25/26',
      bairro: 'Taguatinga Norte',
      cidade: 'Taguatinga',
      uf: 'DF',
      lat: -15.8313,
      lng: -48.0532,
    },
  },

  // ---- Entorno · GO ----
  {
    nome: 'Hospital Estadual da Criança e do Adolescente',
    abrev: 'HECA',
    tipo: 'publico',
    endereco: {
      cep: '72870-508',
      logradouro: 'BR-040 km 6',
      bairro: 'Esplanada',
      cidade: 'Valparaíso de Goiás',
      uf: 'GO',
      lat: -16.0703,
      lng: -47.9843,
    },
  },
  {
    nome: 'Hospital Municipal de Luziânia Dr. Aristides de Souza',
    abrev: 'HML',
    tipo: 'publico',
    endereco: {
      cep: '72800-040',
      logradouro: 'Rua João Mariano',
      bairro: 'Setor Tradicional',
      cidade: 'Luziânia',
      uf: 'GO',
      lat: -16.2533,
      lng: -47.9483,
    },
  },
  {
    nome: 'Hospital Estadual de Águas Lindas Henrique Santillo',
    abrev: 'HEAL',
    tipo: 'publico',
    endereco: {
      cep: '72915-080',
      logradouro: 'BR-070 km 19',
      bairro: 'Setor Central',
      cidade: 'Águas Lindas de Goiás',
      uf: 'GO',
      lat: -15.7619,
      lng: -48.2811,
    },
  },
  {
    nome: 'Hospital Municipal de Formosa',
    abrev: 'HMF',
    tipo: 'publico',
    endereco: {
      cep: '73807-300',
      logradouro: 'Avenida JK',
      bairro: 'Setor Sul',
      cidade: 'Formosa',
      uf: 'GO',
      lat: -15.5408,
      lng: -47.3411,
    },
  },
];

/**
 * Filtro por nome, abreviação ou cidade. Case-insensitive, normaliza
 * acentos pra dar match em "santa lucia" → "Santa Lúcia".
 */
export function buscarSugestoesHospitais(
  query: string,
  limite = 8,
): SugestaoHospital[] {
  const q = normalizar(query.trim());
  if (q.length < 2) return [];
  return HOSPITAIS_BRASILIA.filter((h) => {
    const alvo = normalizar(`${h.nome} ${h.abrev} ${h.endereco.cidade} ${h.endereco.bairro}`);
    return alvo.includes(q);
  }).slice(0, limite);
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
