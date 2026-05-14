import type { Bloco, BlocoPlantao, Hospital, CorFamilia } from '@/types';

/**
 * Tenta converter um evento do Google Calendar em BlocoPlantao. Retorna
 * null se o evento é all-day (sem dateTime), tem range inválido, ou
 * dura mais que 24h (não é plantão razoável).
 */
export function eventoParaPlantao(
  evento: EventoGcal,
  hospitalId: string,
): BlocoPlantao | null {
  const startISO = evento.start?.dateTime;
  const endISO = evento.end?.dateTime;
  if (!startISO || !endISO) return null;
  const inicio = new Date(startISO);
  const fim = new Date(endISO);
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return null;
  const horasMs = (fim.getTime() - inicio.getTime()) / 1000 / 60 / 60;
  if (horasMs <= 0 || horasMs > 24) return null;
  const data = toISOLocal(inicio);
  const horaInicio = inicio.getHours() + inicio.getMinutes() / 60;
  return {
    id: `gcal-${evento.id}`,
    tipo: 'plantao',
    hospitalId,
    data,
    horaInicio,
    duracao: horasMs,
  };
}

function toISOLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const API = 'https://www.googleapis.com/calendar/v3';
const CALENDARIO_NOME = 'Plantões Colo Ritmo';
const TIMEZONE = 'America/Sao_Paulo';

/**
 * Mapeia a cor da família do hospital pro colorId nativo do Google
 * Calendar (11 opções). Plantões herdam a cor do hospital · fica
 * visualmente distinto na grade do Google.
 */
const COR_FAMILIA_PARA_GCAL: Record<CorFamilia, string> = {
  sand: '8', // graphite
  coral: '11', // tomato
  sage: '2', // sage
  olive: '10', // basil
  lavender: '1', // lavender
  pink: '4', // flamingo
  blue: '9', // blueberry
  aqua: '7', // peacock
};

export interface ResultadoGcal<T> {
  ok: true;
  valor: T;
}

export interface ErroGcal {
  ok: false;
  erro: string;
  status?: number;
  reautorizar?: boolean;
}

export type RespostaGcal<T> = ResultadoGcal<T> | ErroGcal;

async function chamada<T>(
  token: string,
  caminho: string,
  init?: RequestInit,
): Promise<RespostaGcal<T>> {
  try {
    const r = await fetch(`${API}${caminho}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        erro: 'sua sessão do google expirou ou perdeu acesso ao calendar · clica em conectar de novo',
        status: r.status,
        reautorizar: true,
      };
    }
    if (!r.ok) {
      const corpo = await r.text();
      return { ok: false, erro: `google api ${r.status}: ${corpo.slice(0, 200)}`, status: r.status };
    }
    if (r.status === 204) return { ok: true, valor: undefined as unknown as T };
    const valor = (await r.json()) as T;
    return { ok: true, valor };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'erro de rede' };
  }
}

export interface CalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}
interface CalendarListResponse {
  items?: CalendarListItem[];
}

export interface EventoGcal {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}
interface EventosListResponse {
  items?: EventoGcal[];
  nextPageToken?: string;
}

/**
 * Testa rapidamente se o token atual tem o scope Calendar. Usado pela
 * UI pra decidir se mostra "conectar" (sem scope) ou "sincronizar"
 * (com scope).
 */
export async function temAcessoCalendar(token: string): Promise<boolean> {
  const r = await chamada<CalendarListResponse>(token, '/users/me/calendarList?maxResults=1');
  return r.ok;
}

/**
 * Acha o calendário dedicado "Plantões Colo Ritmo" ou cria. Idempotente
 * · chamar 2× só retorna o mesmo id. Não mexe nos outros calendários da
 * Mariana.
 */
export async function garantirCalendarioDedicado(
  token: string,
): Promise<RespostaGcal<{ calendarId: string; criado: boolean }>> {
  const lista = await chamada<CalendarListResponse>(token, '/users/me/calendarList');
  if (!lista.ok) return lista;
  const existente = (lista.valor.items ?? []).find((c) => c.summary === CALENDARIO_NOME);
  if (existente) return { ok: true, valor: { calendarId: existente.id, criado: false } };

  const criado = await chamada<{ id: string }>(token, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: CALENDARIO_NOME, timeZone: TIMEZONE }),
  });
  if (!criado.ok) return criado;
  return { ok: true, valor: { calendarId: criado.valor.id, criado: true } };
}

/**
 * Lista calendários acessíveis pela conta. Usado pelo Sync pra deixar
 * o user escolher de qual calendário importar eventos como plantões.
 */
export async function listarCalendarios(
  token: string,
): Promise<RespostaGcal<CalendarListItem[]>> {
  const r = await chamada<CalendarListResponse>(
    token,
    '/users/me/calendarList?fields=items(id,summary,primary,accessRole,backgroundColor)&maxResults=50',
  );
  if (!r.ok) return r;
  return { ok: true, valor: r.valor.items ?? [] };
}

/**
 * Lista eventos de um calendário num intervalo. Faz expansão automática
 * de eventos recorrentes (`singleEvents=true`) · cada ocorrência vira
 * um item separado.
 */
export async function listarEventos(
  token: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<RespostaGcal<EventoGcal[]>> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
    fields: 'items(id,summary,start,end),nextPageToken',
  });
  const r = await chamada<EventosListResponse>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  if (!r.ok) return r;
  return { ok: true, valor: r.valor.items ?? [] };
}

/**
 * Apaga o calendário inteiro do google. Usado pra "limpar tudo" se a
 * Mariana quiser. Não é chamado pelo botão "desconectar" (esse só
 * limpa o mapping local).
 */
export async function apagarCalendario(
  token: string,
  calendarId: string,
): Promise<RespostaGcal<void>> {
  return chamada<void>(token, `/calendars/${encodeURIComponent(calendarId)}`, {
    method: 'DELETE',
  });
}

interface EventoCriado {
  id: string;
  etag: string;
  htmlLink: string;
}

interface EventoBody {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  source?: { title: string; url: string };
}

/**
 * Converte um Bloco em event do Google Calendar. v1 só sincroniza
 * plantões (resto é ruído pro calendário compartilhado com família).
 */
export function eventoDoBloco(bloco: Bloco, hospital: Hospital | undefined): EventoBody | null {
  if (bloco.tipo !== 'plantao') return null;
  const plantao = bloco as BlocoPlantao;
  const inicio = montarISO(plantao.data, plantao.horaInicio);
  const fim = montarISO(plantao.data, plantao.horaInicio + plantao.duracao);
  if (!inicio || !fim) return null;

  const nomeHospital = hospital?.nome ?? hospital?.abrev ?? 'plantão';
  const summary = hospital ? `Plantão · ${hospital.abrev}` : 'Plantão';
  const linhas: string[] = [];
  linhas.push(`Hospital: ${nomeHospital}`);
  linhas.push(`Duração: ${plantao.duracao}h`);
  if (plantao.viaTroca) linhas.push(`Recebido em troca${plantao.trocaInfo ? ' · ' + plantao.trocaInfo : ''}`);

  const evento: EventoBody = {
    summary,
    description: linhas.join('\n'),
    start: { dateTime: inicio, timeZone: TIMEZONE },
    end: { dateTime: fim, timeZone: TIMEZONE },
    source: { title: 'Colo Ritmo', url: 'https://colopediatria.com.br/ritmo/' },
  };
  if (hospital) evento.colorId = COR_FAMILIA_PARA_GCAL[hospital.cor];
  return evento;
}

/**
 * Cria o event no Google Calendar. Retorna eventId + etag (etag será
 * usado em sessão 2 pra atualizar com If-Match).
 */
export async function criarEvento(
  token: string,
  calendarId: string,
  evento: EventoBody,
): Promise<RespostaGcal<EventoCriado>> {
  return chamada<EventoCriado>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(evento),
  });
}

/**
 * Apaga um evento específico do Google Calendar. Usado quando o
 * plantão correspondente é removido do app.
 */
export async function apagarEvento(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<RespostaGcal<void>> {
  return chamada<void>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}

/**
 * Monta um ISO 8601 com offset BRT. Tem `horaInicio` como float
 * (19.5 = 19:30) então separa em horas+minutos. Datas que cruzam
 * meia-noite (horaInicio+duracao > 24) avançam o dia.
 */
function montarISO(dataISO: string, horaDecimal: number): string | null {
  const [anoStr, mesStr, diaStr] = dataISO.split('-');
  if (!anoStr || !mesStr || !diaStr) return null;
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  let dia = parseInt(diaStr, 10);

  let h = horaDecimal;
  while (h >= 24) {
    h -= 24;
    dia += 1;
  }
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  const d = new Date(Date.UTC(ano, mes - 1, dia, horas, minutos));
  if (isNaN(d.getTime())) return null;
  // BRT é UTC-3 ano todo (sem horário de verão desde 2019).
  const isoUtc = d.toISOString().replace('.000Z', '');
  // Mas pra Calendar API o "dateTime" deve ser local com offset.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const HH = String(d.getUTCHours()).padStart(2, '0');
  const MM = String(d.getUTCMinutes()).padStart(2, '0');
  void isoUtc;
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:00-03:00`;
}
