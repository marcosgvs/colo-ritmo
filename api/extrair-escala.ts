import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';
import { fuzzyMatch, normalizarNome } from '../src/lib/fuzzyMatch.js';

/**
 * /api/extrair-escala · OCR + extração estruturada via Claude Vision (tool use).
 *
 * Aceita PDF nativo (Anthropic document API) OU imagem (JPG/PNG/WebP) tirada
 * de escala impressa. O modelo só transcreve · servidor filtra por nome via
 * fuzzyMatch · a transcrição completa volta pro frontend (alimenta Montar).
 *
 * Body:
 *   {
 *     arquivoBase64: string,       // base64 puro (sem data: prefix)
 *     mediaType?: string,          // application/pdf | image/jpeg | image/png | image/webp · default pdf
 *     pdfBase64?: string,          // alias legacy (= arquivoBase64 com mediaType pdf)
 *     hospitalId: string,
 *     hospitalAbrev: string,
 *     nome: string,
 *     apelidoNaEscala?: string,
 *     ano: number, mes: number,
 *   }
 *
 * Resposta:
 *   {
 *     blocos: BlocoPlantao[],      // plantões da médica (após fuzzyMatch)
 *     janelas: Janela[],           // turnos identificados no cabeçalho
 *     celulas: CelulaEscala[],     // transcrição completa (todos os médicos)
 *     avisos: string[],
 *     respostaCrua?: string,       // só presente se o tool não veio · debug
 *   }
 */

type MediaType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const MEDIA_TYPES_VALIDOS: MediaType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

interface ExtractBody {
  arquivoBase64?: string;
  mediaType?: string;
  pdfBase64?: string;
  hospitalId?: string;
  hospitalAbrev?: string;
  nome?: string;
  apelidoNaEscala?: string;
  ano?: number;
  mes?: number;
}

interface ToolInput {
  janelas?: Array<{ rotulo: string; inicio: number; duracao: number }>;
  celulas?: Array<{ data: string; turno: string; nomes: string[] }>;
  avisos?: string[];
}

const MODELO = 'claude-sonnet-4-6';
// Cell-based output é mais verboso · bumpando pra caber HCB com 30 dias
// × 4 colunas × até 17 nomes/célula. ~7k tokens em prática · folga até 16k.
const MAX_TOKENS = 16384;

const FERRAMENTA = {
  name: 'transcrever_escala',
  description:
    'Transcreve a tabela completa da escala oficial, listando todos os médicos por (dia, turno). Não filtra nada — a filtragem é feita no servidor.',
  input_schema: {
    type: 'object',
    properties: {
      janelas: {
        type: 'array',
        description:
          'Turnos identificados no cabeçalho da escala (manhã, tarde, tarde 1, tarde 2, noitinha, noite) com horários inferidos.',
        items: {
          type: 'object',
          properties: {
            rotulo: {
              type: 'string',
              description: 'nome do turno em minúsculo, ex: manhã, tarde 1, noite',
            },
            inicio: { type: 'number', description: 'hora de início decimal (7=07:00)' },
            duracao: { type: 'number', description: 'duração em horas' },
          },
          required: ['rotulo', 'inicio', 'duracao'],
        },
      },
      celulas: {
        type: 'array',
        description:
          'TODAS as células da tabela. Uma entrada por (dia, turno). Inclua TODOS os nomes que aparecem na célula, na ordem em que aparecem. Não pule nenhuma célula. Não pule nomes em células densas (15+ nomes). Não filtre por nenhum critério — transcreva tudo.',
        items: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'data no formato YYYY-MM-DD. Pode ser do mês de referência ou do mês seguinte se a tabela emendar.',
            },
            turno: {
              type: 'string',
              description: 'rótulo do turno conforme o cabeçalho (manhã, tarde, tarde 1, noitinha, noite, etc)',
            },
            nomes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Nomes EXATAMENTE como aparecem na escala, na ordem em que aparecem na célula. Inclua sufixos (BHP, CRO, BHN, CEP, CP, Pr) e marcadores (* ²) se estiverem junto do nome. Não normalize. Liste TODOS os nomes da célula — não pare na metade.',
            },
          },
          required: ['data', 'turno', 'nomes'],
        },
      },
      avisos: {
        type: 'array',
        description: 'Linhas ou células ilegíveis ou ambíguas que valham mencionar.',
        items: { type: 'string' },
      },
    },
    required: ['janelas', 'celulas', 'avisos'],
  },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const body = (req.body ?? {}) as ExtractBody;
  const { hospitalId, hospitalAbrev, nome, apelidoNaEscala, ano, mes } = body;

  // Backward compat: pdfBase64 ainda é aceito. mediaType default pdf.
  const arquivoBase64 = body.arquivoBase64 ?? body.pdfBase64;
  const mediaTypeRaw = (body.mediaType ?? 'application/pdf').toLowerCase();
  const mediaType = MEDIA_TYPES_VALIDOS.includes(mediaTypeRaw as MediaType)
    ? (mediaTypeRaw as MediaType)
    : null;

  if (!arquivoBase64 || !hospitalId || !nome || !ano || !mes) {
    res.status(400).json({
      erro: 'payload incompleto · arquivoBase64, hospitalId, nome, ano, mes obrigatórios',
    });
    return;
  }

  if (!mediaType) {
    res.status(400).json({
      erro: `mediaType não suportado · use ${MEDIA_TYPES_VALIDOS.join(' | ')}`,
    });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const apelido = apelidoNaEscala?.trim() || nome;
  const prompt = montarPrompt({
    hospitalAbrev: hospitalAbrev ?? hospitalId,
    ano,
    mes,
  });

  // Anthropic API · PDF usa `document`, imagem usa `image`. Schema do source
  // é o mesmo (base64 + media_type), só muda o tipo do bloco.
  const bloco =
    mediaType === 'application/pdf'
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: arquivoBase64 },
        }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: arquivoBase64 },
        };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        tools: [FERRAMENTA],
        tool_choice: { type: 'tool', name: FERRAMENTA.name },
        messages: [
          {
            role: 'user',
            content: [bloco, { type: 'text', text: prompt }],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('extrair-escala: anthropic falhou', resp.status, txt);
      res.status(502).json({ erro: `anthropic ${resp.status}`, detalhe: txt.slice(0, 400) });
      return;
    }

    const json = (await resp.json()) as {
      content?: Array<{ type: string; input?: unknown; text?: string }>;
    };
    const tool = json.content?.find((c) => c.type === 'tool_use');
    if (!tool || !tool.input) {
      const texto = json.content?.find((c) => c.type === 'text')?.text ?? '';
      res.status(200).json({
        blocos: [],
        variantes: [],
        janelas: [],
        celulas: [],
        avisos: ['tive dificuldade pra organizar a resposta · veja abaixo o que recebi e tenta de novo'],
        respostaCrua: texto || '(resposta vazia)',
      });
      return;
    }

    const parsed = construirResposta(tool.input as ToolInput, hospitalId, apelido);
    res.status(200).json(parsed);
  } catch (err) {
    console.error('extrair-escala: exceção', err);
    res.status(500).json({ erro: 'algo travou aqui ao ler o arquivo · tenta de novo' });
  }
}

interface BlocoImport {
  id: string;
  tipo: 'plantao';
  hospitalId: string;
  data: string;
  horaInicio: number;
  duracao: number;
}

interface Variante {
  /** Grafia canônica (a primeira ocorrência que apareceu na escala). */
  nome: string;
  /** Quantos plantões foram detectados com essa grafia. */
  count: number;
  /** ids dos blocos dessa variante · usados no frontend pra filtrar após o usuário escolher. */
  blocoIds: string[];
}

function construirResposta(
  input: ToolInput,
  hospitalId: string,
  apelido: string,
): {
  blocos: BlocoImport[];
  variantes: Variante[];
  janelas: Array<{ rotulo: string; inicio: number; duracao: number }>;
  celulas: Array<{ data: string; turno: string; nomes: string[] }>;
  avisos: string[];
} {
  const janelas = (input.janelas ?? []).map((j) => ({
    rotulo: String(j.rotulo).toLowerCase().trim(),
    inicio: Number(j.inicio),
    duracao: Number(j.duracao),
  }));
  const celulas = (input.celulas ?? []).map((c) => ({
    data: String(c.data),
    turno: String(c.turno).toLowerCase().trim(),
    nomes: Array.isArray(c.nomes) ? c.nomes.map((n) => String(n)) : [],
  }));

  const avisos = [...(input.avisos ?? [])];

  // Pra cada célula, descobre quais nomes batem com o apelido. Cada nome
  // distinto que bateu vira uma "variante" · o frontend mostra todas e o
  // usuário escolhe qual(is) é/são ele.
  // Normalização: agrupa "Mariana A" e "MARIANA A" na mesma variante,
  // mas mantém "Mariana A" e "Mariana C" separados.
  const janelaPor = new Map(janelas.map((j) => [j.rotulo, j]));
  const blocos: BlocoImport[] = [];
  const variantesByKey = new Map<string, { nome: string; blocos: BlocoImport[] }>();
  const baseId = Date.now();

  for (const c of celulas) {
    // Acha o primeiro nome da célula que bate com o apelido (pra evitar
    // duplicar plantão se uma célula tiver o mesmo nome duas vezes).
    const nomeMatch = c.nomes.find((n) => fuzzyMatch(n, apelido));
    if (!nomeMatch) continue;
    const janela = janelaPor.get(c.turno);
    if (!janela) {
      avisos.push(
        `dia ${c.data} · turno "${c.turno}" sem janela correspondente — plantão não foi importado, confira manualmente`,
      );
      continue;
    }
    const bloco: BlocoImport = {
      id: `import-${baseId}-${blocos.length}`,
      tipo: 'plantao',
      hospitalId,
      data: c.data,
      horaInicio: janela.inicio,
      duracao: janela.duracao,
    };
    blocos.push(bloco);

    const chave = normalizarNome(nomeMatch);
    const grupo = variantesByKey.get(chave);
    if (grupo) {
      grupo.blocos.push(bloco);
    } else {
      variantesByKey.set(chave, { nome: nomeMatch.trim(), blocos: [bloco] });
    }
  }

  const variantes: Variante[] = Array.from(variantesByKey.values())
    .map((g) => ({
      nome: g.nome,
      count: g.blocos.length,
      blocoIds: g.blocos.map((b) => b.id),
    }))
    .sort((a, b) => b.count - a.count);

  return { blocos, variantes, janelas, celulas, avisos };
}

function diaDaSemana(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getUTCDay()]!;
}

function montarPrompt(opts: { hospitalAbrev: string; ano: number; mes: number }): string {
  const mesPad = String(opts.mes).padStart(2, '0');
  const mesSeguinte = opts.mes === 12 ? 1 : opts.mes + 1;
  const anoSeguinte = opts.mes === 12 ? opts.ano + 1 : opts.ano;
  const mesSeguintePad = String(mesSeguinte).padStart(2, '0');
  const diaUm = diaDaSemana(opts.ano, opts.mes, 1);

  return `Você está lendo a escala mensal de plantões do hospital "${opts.hospitalAbrev}" referente a ${mesPad}/${opts.ano}.

O arquivo pode ser um PDF ou uma foto/imagem de uma escala impressa (às vezes manuscrita). Use o mesmo critério em ambos os casos: transcrever, não filtrar.

SUA TAREFA · TRANSCREVER A TABELA COMPLETA
Você NÃO precisa filtrar por nenhum nome. Sua única tarefa é TRANSCREVER fielmente a tabela na ferramenta \`transcrever_escala\`. O servidor faz a filtragem depois.

CONTEXTO PRA ÂNCORA DE DATAS
- Mês de referência: ${mesPad}/${opts.ano}.
- O dia 1 desse mês é ${diaUm}-feira (${opts.ano}-${mesPad}-01).
- ALGUMAS escalas só mostram dia da semana (SEGUNDA, TERÇA...) sem o número do dia. Use a âncora acima pra contar dia 1, 2, 3... a partir da primeira linha.
- ALGUMAS escalas trazem dias do MÊS SEGUINTE de carona no fim. Inclua esses normalmente, com a data REAL (${anoSeguinte}-${mesSeguintePad}-DD).

PARTE 1 · JANELAS DE TURNO
Identifique o cabeçalho com as colunas/turnos do hospital. Inferir hora de início e duração se não estiver explícito:
- manhã: 7-13 (6h)
- tarde / tarde 1 / tarde 2: 13-19 (6h)
- noitinha: 19-00 (5h)
- noite: 19-07 (12h)

PARTE 2 · CÉLULAS
Pra CADA célula da tabela (combinação de um dia × uma coluna de turno), produza uma entrada com:
- data: YYYY-MM-DD da linha
- turno: rótulo da coluna (manhã, tarde, tarde 1, etc)
- nomes: TODOS os nomes que aparecem na célula, na ordem em que aparecem

REGRAS RÍGIDAS DE TRANSCRIÇÃO:
1. **Não pule células.** Se um turno tem coluna no cabeçalho, gere uma entrada por dia, mesmo que a célula esteja vazia (nomes: []).
2. **Não pule nomes em células densas.** Se uma célula tem 15-17 nomes empilhados, liste TODOS os 15-17. Não pare no 5º.
3. **Mantenha a grafia exata.** Não normalize "MPinheiro" pra "Mpinheiro" · não tire sufixos (BHP, BHN, CRO, CEP, CP, Pr) · não tire marcadores (* ² (pg)). Esses fazem parte do nome na escala.
4. **Nome com "+" ou "," é uma célula com múltiplos nomes:** "Bruna + Mariana" → nomes: ["Bruna", "Mariana"]. Quebre eles separadamente.
5. **Não invente nomes.** Se não tem certeza do nome, melhor adicionar um aviso do que arriscar.
6. **Não filtre por nenhum nome específico.** Liste TUDO. O servidor filtra depois.
7. **Inclua a "seção compactada"** que algumas escalas trazem no fim com os últimos dias do mês — não pare na primeira parte.

Avisos só pra linha ilegível, célula ambígua, ou casos onde a estrutura da tabela não dava pra entender. Não avise sobre marcadores de extra/troca.`;
}
