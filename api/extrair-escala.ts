import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';

/**
 * /api/extrair-escala · OCR + extração estruturada via Claude Vision.
 *
 * Body:
 *   {
 *     pdfBase64: string,        // PDF bruto em base64
 *     hospitalId: string,       // contexto pra Claude saber o hospital
 *     hospitalAbrev: string,    // ex: "HSLz", aparece no PDF pra dar dica
 *     nome: string,             // nome esperado da médica (filtra)
 *     ano: number, mes: number, // mês de referência
 *   }
 *
 * Resposta:
 *   {
 *     blocos: BlocoPlantao[],   // só os plantões da médica
 *     janelas: Janela[],        // turnos reconhecidos no cabeçalho
 *     avisos: string[],         // ambiguidades/anotações detectadas
 *   }
 *
 * Modelo: claude-sonnet-4-6 (vision robusto, lida bem com PDFs caóticos
 * tipo HCB com 17 médicos por turno).
 */

interface ExtractBody {
  pdfBase64?: string;
  hospitalId?: string;
  hospitalAbrev?: string;
  nome?: string;
  ano?: number;
  mes?: number;
}

interface ExtractedBloco {
  data: string;
  horaInicio: number;
  duracao: number;
}

interface ExtractedJanela {
  rotulo: string;
  inicio: number;
  duracao: number;
}

const MODELO = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const body = (req.body ?? {}) as ExtractBody;
  const { pdfBase64, hospitalId, hospitalAbrev, nome, ano, mes } = body;

  if (!pdfBase64 || !hospitalId || !nome || !ano || !mes) {
    res.status(400).json({
      erro: 'payload incompleto · pdfBase64, hospitalId, nome, ano, mes obrigatórios',
    });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const prompt = montarPrompt({ hospitalAbrev: hospitalAbrev ?? hospitalId, nome, ano, mes });

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

    const json = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const texto = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const parsed = parsearResposta(texto, hospitalId);

    res.status(200).json(parsed);
  } catch (err) {
    console.error('extrair-escala: exceção', err);
    res.status(500).json({ erro: 'algo travou aqui ao ler o PDF · tenta de novo' });
  }
}

function montarPrompt(opts: {
  hospitalAbrev: string;
  nome: string;
  ano: number;
  mes: number;
}): string {
  const mesPad = String(opts.mes).padStart(2, '0');
  return `Você está lendo a escala mensal de plantões do hospital "${opts.hospitalAbrev}" referente a ${mesPad}/${opts.ano}.

Sua tarefa tem DUAS partes:

PARTE 1 — JANELAS DE TURNO
Identifique no cabeçalho (ou em qualquer parte do documento) as janelas/turnos usados pelo hospital.
Exemplo HSLz: "MANHÃ", "TARDE 1", "TARDE 2", "NOITINHA", "NOITE".
Pra cada janela, infira hora de início e duração em horas. Use convenções comuns se não estiver explícito:
- manhã: 7-13 (6h)
- tarde / tarde 1 / tarde 2: 13-19 (6h)
- noitinha: 19-00 (5h)
- noite: 19-07 (12h)

PARTE 2 — PLANTÕES DA MÉDICA
Encontre TODOS os plantões em que aparece o nome "${opts.nome}" (procure também variações: primeiro nome só, "Dra. ${opts.nome}", abreviações tipo "Mari").
Pra cada ocorrência:
- "data" no formato YYYY-MM-${mesPad} (ano e mês fixos do contexto)
- "horaInicio" decimal (7=07:00, 19.5=19:30) baseado na janela em que ela aparece
- "duracao" em horas baseado na janela

REGRAS IMPORTANTES:
- Se um nome aparece em itálico ou marcado especialmente, ainda inclua como plantão regular (ignora regras condicionais tipo "amplia se UTI cheia" — fica como aviso).
- Se houver anotação tipo "*", "²", "(pg)" ao lado do nome, mantém o plantão regular E adiciona o que viu no array "avisos".
- Se houver dúvida em alguma linha (nome ambíguo, horário ilegível), NÃO inclua e mande no "avisos".
- Não inclua plantões de OUTROS médicos (só os de "${opts.nome}").

FORMATO DE RESPOSTA (devolva SOMENTE este JSON, sem markdown, sem explicação):
{
  "janelas": [
    { "rotulo": "manhã", "inicio": 7, "duracao": 6 }
  ],
  "blocos": [
    { "data": "${opts.ano}-${mesPad}-04", "horaInicio": 19, "duracao": 5 }
  ],
  "avisos": [
    "dia 08: nome com asterisco · pode ser extra FDS"
  ]
}`;
}

interface RespostaExtraida {
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
}

function parsearResposta(texto: string, hospitalId: string): RespostaExtraida {
  // Tolerância a markdown · Claude às vezes ignora "sem markdown".
  const limpo = texto
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const json = JSON.parse(limpo) as {
      blocos?: ExtractedBloco[];
      janelas?: ExtractedJanela[];
      avisos?: string[];
    };
    const blocos = (json.blocos ?? []).map((b, i) => ({
      id: `import-${Date.now()}-${i}`,
      tipo: 'plantao' as const,
      hospitalId,
      data: b.data,
      horaInicio: Number(b.horaInicio),
      duracao: Number(b.duracao),
    }));
    const janelas = (json.janelas ?? []).map((j) => ({
      rotulo: String(j.rotulo).toLowerCase().trim(),
      inicio: Number(j.inicio),
      duracao: Number(j.duracao),
    }));
    return { blocos, janelas, avisos: json.avisos ?? [] };
  } catch (err) {
    return {
      blocos: [],
      janelas: [],
      avisos: [`não consegui ler a resposta do modelo · ${(err as Error).message}`],
    };
  }
}
