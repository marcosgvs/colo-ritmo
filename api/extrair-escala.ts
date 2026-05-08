import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';

/**
 * /api/extrair-escala · OCR + extração estruturada via Claude Vision.
 *
 * Body:
 *   {
 *     pdfBase64: string,        // PDF bruto em base64
 *     hospitalId: string,       // contexto pra Claude saber o hospital
 *     nome?: string,            // nome esperado da médica (filtra)
 *     ano: number, mes: number, // mês de referência
 *   }
 *
 * Resposta:
 *   { blocos: BlocoPlantao[], avisos: string[] }
 *
 * Modelo: claude-haiku-4-5 (rápido + barato pra extração estruturada).
 * Se a escala for muito longa, sobe pra sonnet-4-6.
 */

interface ExtractBody {
  pdfBase64?: string;
  hospitalId?: string;
  nome?: string;
  ano?: number;
  mes?: number;
}

interface ExtractedBloco {
  data: string;
  horaInicio: number;
  duracao: number;
  setor?: string;
}

const MODELO_DEFAULT = 'claude-haiku-4-5';
const MAX_TOKENS = 4096;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const body = (req.body ?? {}) as ExtractBody;
  const { pdfBase64, hospitalId, nome, ano, mes } = body;

  if (!pdfBase64 || !hospitalId || !ano || !mes) {
    res.status(400).json({
      erro: 'payload incompleto · pdfBase64, hospitalId, ano, mes obrigatórios',
    });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const prompt = montarPrompt({ hospitalId, nome, ano, mes });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO_DEFAULT,
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
  hospitalId: string;
  nome?: string;
  ano: number;
  mes: number;
}): string {
  const linhas = [
    `Você está lendo a escala mensal de plantões do hospital ${opts.hospitalId} de ${String(
      opts.mes,
    ).padStart(2, '0')}/${opts.ano}.`,
    opts.nome
      ? `Foque APENAS nas linhas que contêm o nome "${opts.nome}" (ou variações tipo Dra./Dr. + sobrenome).`
      : 'Liste TODOS os plantões da escala.',
    '',
    'Pra cada plantão extraído, devolva um JSON no formato:',
    '{ "blocos": [ { "data": "YYYY-MM-DD", "horaInicio": 7, "duracao": 12, "setor": "UTI" } ], "avisos": [ "..." ] }',
    '',
    'Regras:',
    '- "horaInicio" é número decimal (7 = 07:00, 19.5 = 19:30).',
    '- "duracao" em horas. Plantão noturno típico = 12h.',
    '- Se a escala usar abreviações pra setor (UTI, PS, ENF), preserve.',
    '- Se houver dúvida em alguma linha, mande no array "avisos" e NÃO inclua o bloco.',
    '- Devolva SOMENTE o JSON. Sem markdown, sem ```json, sem explicação.',
  ];
  return linhas.join('\n');
}

function parsearResposta(texto: string, hospitalId: string): {
  blocos: Array<{
    id: string;
    tipo: 'plantao';
    hospitalId: string;
    data: string;
    horaInicio: number;
    duracao: number;
    setor: string;
  }>;
  avisos: string[];
} {
  // Tolerância a markdown — Claude às vezes ignora "sem markdown".
  const limpo = texto.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    const json = JSON.parse(limpo) as {
      blocos?: ExtractedBloco[];
      avisos?: string[];
    };
    const blocos = (json.blocos ?? []).map((b, i) => ({
      id: `import-${Date.now()}-${i}`,
      tipo: 'plantao' as const,
      hospitalId,
      data: b.data,
      horaInicio: Number(b.horaInicio),
      duracao: Number(b.duracao),
      setor: b.setor ?? '',
    }));
    return { blocos, avisos: json.avisos ?? [] };
  } catch (err) {
    return {
      blocos: [],
      avisos: [`não consegui ler a resposta do modelo · ${(err as Error).message}`],
    };
  }
}
