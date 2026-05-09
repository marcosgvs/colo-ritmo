import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';

/**
 * /api/extrair-escala · OCR + extração estruturada via Claude Vision (tool use).
 *
 * Body:
 *   {
 *     pdfBase64: string,           // PDF bruto em base64
 *     hospitalId: string,          // contexto pra Claude saber o hospital
 *     hospitalAbrev: string,       // ex: "HCB", aparece no PDF pra dar dica
 *     nome: string,                // nome completo do usuário
 *     apelidoNaEscala?: string,    // apelido específico desse hospital (Mpinheiro, Mariana, etc) · cai pra `nome` se vazio
 *     ano: number, mes: number,    // mês de referência
 *   }
 *
 * Resposta:
 *   {
 *     blocos: BlocoPlantao[],      // só os plantões da médica
 *     janelas: Janela[],           // turnos reconhecidos no cabeçalho
 *     avisos: string[],            // ambiguidades detectadas
 *     respostaCrua?: string,       // só presente se o modelo não devolveu o tool · pra debug
 *   }
 *
 * Modelo: claude-sonnet-4-6 com tool use (saída JSON estruturada e garantida).
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
  blocos?: Array<{ data: string; horaInicio: number; duracao: number }>;
  avisos?: string[];
}

const MODELO = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

const FERRAMENTA = {
  name: 'registrar_escala',
  description:
    'Registra os plantões da médica encontrados no PDF da escala oficial, junto com as janelas de turno usadas pelo hospital.',
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
              description: 'nome do turno em minúsculo, ex: manhã, tarde, tarde 1, noitinha, noite',
            },
            inicio: {
              type: 'number',
              description: 'hora de início, decimal (7=07:00, 19.5=19:30)',
            },
            duracao: { type: 'number', description: 'duração em horas' },
          },
          required: ['rotulo', 'inicio', 'duracao'],
        },
      },
      blocos: {
        type: 'array',
        description: 'Cada plantão da médica encontrado no PDF (uma célula = um bloco).',
        items: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description:
                'data no formato YYYY-MM-DD. PODE estar fora do mês de referência se a tabela emendar dias do mês seguinte/anterior.',
            },
            horaInicio: {
              type: 'number',
              description: 'hora de início baseada na coluna onde a célula está',
            },
            duracao: {
              type: 'number',
              description: 'duração em horas baseada na coluna onde a célula está',
            },
          },
          required: ['data', 'horaInicio', 'duracao'],
        },
      },
      avisos: {
        type: 'array',
        description:
          'Linhas ilegíveis ou ambíguas SOMENTE quanto a nome ou horário (não sobre extras/trocas).',
        items: { type: 'string' },
      },
    },
    required: ['janelas', 'blocos', 'avisos'],
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
  const nomeBusca = apelidoNaEscala?.trim() || nome;
  const prompt = montarPrompt({
    hospitalAbrev: hospitalAbrev ?? hospitalId,
    nomeBusca,
    nomeCompleto: nome,
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
        avisos: ['tive dificuldade pra organizar a resposta dessa vez · veja abaixo o que recebi e tenta de novo'],
        respostaCrua: texto || '(resposta vazia)',
      });
      return;
    }

    const parsed = construirResposta(tool.input as ToolInput, hospitalId);
    res.status(200).json(parsed);
  } catch (err) {
    console.error('extrair-escala: exceção', err);
    res.status(500).json({ erro: 'algo travou aqui ao ler o PDF · tenta de novo' });
  }
}

function construirResposta(input: ToolInput, hospitalId: string): {
  blocos: Array<{
    id: string;
    tipo: 'plantao';
    hospitalId: string;
    data: string;
    horaInicio: number;
    duracao: number;
  }>;
  janelas: Array<{ rotulo: string; inicio: number; duracao: number }>;
  avisos: string[];
} {
  const blocos = (input.blocos ?? []).map((b, i) => ({
    id: `import-${Date.now()}-${i}`,
    tipo: 'plantao' as const,
    hospitalId,
    data: String(b.data),
    horaInicio: Number(b.horaInicio),
    duracao: Number(b.duracao),
  }));
  const janelas = (input.janelas ?? []).map((j) => ({
    rotulo: String(j.rotulo).toLowerCase().trim(),
    inicio: Number(j.inicio),
    duracao: Number(j.duracao),
  }));
  return { blocos, janelas, avisos: input.avisos ?? [] };
}

function diaDaSemana(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getUTCDay()];
}

function montarPrompt(opts: {
  hospitalAbrev: string;
  nomeBusca: string;
  nomeCompleto: string;
  ano: number;
  mes: number;
}): string {
  const mesPad = String(opts.mes).padStart(2, '0');
  const mesSeguinte = opts.mes === 12 ? 1 : opts.mes + 1;
  const anoSeguinte = opts.mes === 12 ? opts.ano + 1 : opts.ano;
  const mesSeguintePad = String(mesSeguinte).padStart(2, '0');
  const diaUm = diaDaSemana(opts.ano, opts.mes, 1);
  const apelidoExtra =
    opts.nomeBusca !== opts.nomeCompleto
      ? `; nome completo da médica é "${opts.nomeCompleto}" — útil só pra confirmar`
      : '';

  return `Você está lendo a escala mensal de plantões do hospital "${opts.hospitalAbrev}" referente a ${mesPad}/${opts.ano}.

CONTEXTO PRA ÂNCORA DE DATAS
- Mês de referência: ${mesPad}/${opts.ano}.
- O dia 1 desse mês é ${diaUm}-feira (${opts.ano}-${mesPad}-01).
- ALGUMAS escalas só mostram dia da semana (SEGUNDA, TERÇA...) sem o número do dia. Use a âncora acima pra contar dia 1, 2, 3... a partir da primeira linha.
- ALGUMAS escalas trazem dias do MÊS SEGUINTE de carona no fim. Inclua esses normalmente, mas com a data REAL do mês seguinte (${anoSeguinte}-${mesSeguintePad}-DD), nunca colando como se fossem do mês de referência.

PARTE 1 — JANELAS DE TURNO
Identifique no cabeçalho as janelas/turnos usadas pelo hospital. Convenções comuns se não estiver explícito:
- manhã: 7-13 (6h)
- tarde / tarde 1 / tarde 2: 13-19 (6h)
- noitinha: 19-00 (5h)
- noite: 19-07 (12h)

PARTE 2 — PLANTÕES DA MÉDICA
Encontre TODAS as células onde aparece "${opts.nomeBusca}"${apelidoExtra}.

Match case-insensitive. Considere variações: com/sem acento, prefixos "Dra.", abreviações.

REGRA CRÍTICA · MÚLTIPLOS NOMES NA MESMA CÉLULA:
Uma célula pode ter VÁRIOS médicos juntos com "+", ",", "/" ou empilhados. Exemplos:
- "Bruna + Mariana" → Mariana TEM plantão nessa célula
- "Lucas, Carol" → ambos têm plantão
- nomes empilhados verticalmente numa célula com 10+ médicos → cada um é um plantão se o nome bater

Não pule a célula só porque ela tem outros nomes junto.

REGRA SIMPLES POR CÉLULA: identificou o nome → 1 plantão regular. PONTO.
- Mesmo que o nome esteja em itálico, com "*", "²", "(pg)", sufixos como "BHP", "BHN", "CRO", "CEP", "CP" ou outra anotação → é plantão regular.
- Não interpreta · não classifica como troca/extra/cedido · não gera avisos sobre isso.
- Cada CÉLULA distinta da tabela onde o nome aparece = 1 plantão. Mesmo dia pode ter 2+ plantões em colunas diferentes (manhã + noite, tarde 2 + noitinha, etc).

Pra cada plantão encontrado:
- "data" no formato YYYY-MM-DD (mês livre — pode ser ${mesPad} ou ${mesSeguintePad} dependendo da linha)
- "horaInicio" decimal baseado na coluna (janela) onde está
- "duracao" em horas baseado na coluna

Inclua em "avisos" SOMENTE se uma linha estiver ilegível ou ambígua quanto a NOME ou HORÁRIO. Não avise sobre marcadores de troca/extra.

Não inclua plantões de OUTROS médicos.

VARRA TODA A TABELA · cada coluna e cada linha. Cada célula visível precisa ser checada. Não pule a "seção compactada" que alguns PDFs trazem no fim com os últimos dias do mês.`;
}
