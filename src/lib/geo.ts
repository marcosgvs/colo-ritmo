/**
 * Helpers geográficos · puros (haversine/multiplicador) e integrações
 * com APIs públicas (ViaCEP, Nominatim). Nominatim limita 1 req/s — o
 * helper enfileira pra não passar.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Endereco {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Formato BR: 70335-000 com hífen. */
  cepFormatado: string;
}

/** Distância em km entre dois pontos · fórmula de haversine. */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371; // raio Terra em km
  const dLat = grausParaRad(b.lat - a.lat);
  const dLng = grausParaRad(b.lng - a.lng);
  const lat1 = grausParaRad(a.lat);
  const lat2 = grausParaRad(b.lat);
  const sa =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  return R * c;
}

function grausParaRad(g: number): number {
  return (g * Math.PI) / 180;
}

/**
 * Multiplicador de tempo de trajeto pela hora do dia.
 *   pico manhã  · 7-9   → 1.5x
 *   pico tarde  · 17-20 → 1.5x
 *   madrugada   · 0-6   → 0.7x
 *   demais                → 1.0x
 *
 * Brasília (sem rodízio, sem metrô forte) tem essas janelas bem
 * definidas. A partir da Sessão 4 podemos puxar dados reais de OSRM /
 * Mapbox e aposentar essa heurística.
 */
export function multiplicadorTransito(hora: number): number {
  const h = ((hora % 24) + 24) % 24;
  if (h >= 0 && h < 6) return 0.7;
  if (h >= 7 && h < 9) return 1.5;
  if (h >= 17 && h < 20) return 1.5;
  return 1.0;
}

const VIACEP_BASE = 'https://viacep.com.br/ws';

/** Busca CEP no ViaCEP. Retorna null se não encontrado. */
export async function buscarCep(cep: string): Promise<Endereco | null> {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const resp = await fetch(`${VIACEP_BASE}/${limpo}/json/`);
    if (!resp.ok) return null;
    const json = (await resp.json()) as Record<string, unknown>;
    if (json['erro']) return null;
    return {
      cep: limpo,
      cepFormatado: `${limpo.slice(0, 5)}-${limpo.slice(5)}`,
      logradouro: typeof json['logradouro'] === 'string' ? json['logradouro'] : '',
      bairro: typeof json['bairro'] === 'string' ? json['bairro'] : '',
      cidade: typeof json['localidade'] === 'string' ? json['localidade'] : '',
      uf: typeof json['uf'] === 'string' ? json['uf'] : '',
    };
  } catch {
    return null;
  }
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_INTERVALO_MS = 1100;

let nominatimQueue: Promise<unknown> = Promise.resolve();

/**
 * Geocodifica via Nominatim. Respeita o limite "1 req/s" enfileirando
 * chamadas — em rajada, cada call espera ~1.1s antes da próxima sair.
 * Retorna null se nada encontrado.
 */
export async function geocodificar(query: string): Promise<LatLng | null> {
  const proximo = nominatimQueue.then(async () => {
    try {
      const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
      const resp = await fetch(url, {
        headers: {
          // Nominatim exige User-Agent identificável.
          'User-Agent': 'colo-ritmo/0.1 (https://colopediatria.com.br)',
          Accept: 'application/json',
        },
      });
      if (!resp.ok) return null;
      const arr = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
      if (arr.length === 0) return null;
      const item = arr[0]!;
      const lat = parseFloat(item.lat ?? '');
      const lng = parseFloat(item.lon ?? '');
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    } catch {
      return null;
    }
  });

  // Próxima chamada espera o intervalo após esta resolver.
  nominatimQueue = proximo.then(() => sleep(NOMINATIM_INTERVALO_MS));
  return proximo;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
