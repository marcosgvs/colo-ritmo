import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';
import { fuzzyMatch } from '../src/lib/fuzzyMatch.js';

/**
 * /api/extrair-escala · OCR + extração estruturada via Claude Vision (tool use).
 *
 * Estratégia · "modelo só transcreve, código filtra":
 *   1. O modelo recebe o PDF e devolve, via tool use, a transcrição
 *      completa da tabela — uma entrada por (dia, turno) com a lista de
 *      todos os nomes que aparecem na célula.
 *   2. O servidor faz fuzzyMatch (acento, case, typo, sufixo) em código
 *      pra encontrar a médica e produzir os plantões.
 *   3. A transcrição inteira volta pro frontend pra ser guardada — vai
 *      alimentar futuramente o "padrão do chefe" no Montar.
 *
 * Por que assim · pedir pro modelo "filtrar pelo nome" se mostrou frágil:
 * tabela densa do HCB faz ele perder nomes ou alucinar. Transcrever é
 * tarefa simples (visão pura) e o filtro fica determinístico no código.
 *
 * Body:
 *   {
 *     pdfBase64: string,
 *     hospitalId: string,
 *     hospitalAbrev: string,
 *     nome: string,                // nome completo do usuário (fallback)
 *     apelidoNaEscala?: string,    // como aparece no PDF (ex: Mpinheiro)
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

interface ExtractBody {
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
    'Transcreve a tabela completa da escala oficial do PDF, listando todos os médicos por (dia, turno). Não filtra nada — a filtragem é feita no servidor.',
  input_schema: {
    type: 'object',
    properties: {
      janelas: {
        type: 'array',
        description:
          'Turnos identificados no cabeçalho do PDF (manhã, tarde, tarde 1, tarde 2, noitinha, noite) com horários inferidos.',
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
              description: 'Nomes EXATAMENTE como aparecem no PDF, na ordem em que aparecem na célula. Inclua sufixos (BHP, CRO, BHN, CEP, CP, Pr) e marcadores (* ²) se estiverem junto do nome. Não normalize. Liste TODOS os nomes da célula — não pare na metade.',
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
  const { pdfBase64, hospitalId, hospitalAbrev, nome, apelidoNaEscala, ano, mes } = body;

  if (!pdfBase64 || !hospitalId || !nome || !ano || !mes) {
    res.status(400).json({
      erro: 'payload incompleto · pdfBase64, hospitalId, nome, ano, mes obrigatórios',
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
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
              },
              { type: 'text', text: prompt },
            ],
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
    res.status(500).json({ erro: 'algo travou aqui ao ler o PDF · tenta de novo' });
  }
}

function construirResposta(
  input: ToolInput,
  hospitalId: string,
  apelido: string,
): {
  blocos: Array<{
    id: string;
    tipo: 'plantao';
    hospitalId: string;
    data: string;
    horaInicio: number;
    duracao: number;
  }>;
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

  // Pra cada célula, descobre se a médica está lá (fuzzyMatch sobre cada nome).
  // Se sim, mapeia o turno → janela pra calcular horaInicio/duracao.
  const janelaPor = new Map(janelas.map((j) => [j.rotulo, j]));
  const blocos: Array<{
    id: string;
    tipo: 'plantao';
    hospitalId: string;
    data: string;
    horaInicio: number;
    duracao: number;
  }> = [];
  const baseId = Date.now();
  for (const c of celulas) {
    const matched = c.nomes.some((n) => fuzzyMatch(n, apelido));
    if (!matched) continue;
    const janela = janelaPor.get(c.turno);
    if (!janela) {
      avisos.push(
        `dia ${c.data} · turno "${c.turno}" sem janela correspondente — plantão não foi importado, confira manualmente`,
      );
      continue;
    }
    blocos.push({
      id: `import-${baseId}-${blocos.length}`,
      tipo: 'plantao',
      hospitalId,
      data: c.data,
      horaInicio: janela.inicio,
      duracao: janela.duracao,
    });
  }

  return { blocos, janelas, celulas, avisos };
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

SUA TAREFA · TRANSCREVER A TABELA COMPLETA
Você NÃO precisa filtrar por nenhum nome. Sua única tarefa é TRANSCREVER fielmente a tabela do PDF na ferramenta \`transcrever_escala\`. O servidor faz a filtragem depois.

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
3. **Mantenha a grafia exata.** Não normalize "MPinheiro" pra "Mpinheiro" · não tire sufixos (BHP, BHN, CRO, CEP, CP, Pr) · não tire marcadores (* ² (pg)). Esses fazem parte do nome no PDF.
4. **Nome com "+" ou "," é uma célula com múltiplos nomes:** "Bruna + Mariana" → nomes: ["Bruna", "Mariana"]. Quebre eles separadamente.
5. **Não invente nomes.** Se não tem certeza do nome, melhor adicionar um aviso do que arriscar.
6. **Não filtre por nenhum nome específico.** Liste TUDO. O servidor filtra depois.
7. **Inclua a "seção compactada"** que alguns PDFs trazem no fim com os últimos dias do mês — não pare na primeira parte.

Avisos só pra linha ilegível, célula ambígua, ou casos onde a estrutura da tabela não dava pra entender. Não avise sobre marcadores de extra/troca.`;
}
