import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';

/**
 * /api/regras-parse · conversa iterativa pra estruturar regras de hospital.
 *
 * Body:
 *   {
 *     hospitalNome: string,
 *     hospitalTipo: 'publico' | 'privado',
 *     mensagens: Array<{ role: 'user' | 'assistant', content: string }>,
 *     regrasAtuais?: RegrasHospital,
 *   }
 *
 * Resposta:
 *   {
 *     resposta: string,           // texto pra mostrar no chat
 *     regrasPropostas?: RegrasHospital,  // se atingiu coerência, sugere aplicar
 *     concluido: boolean,         // true quando IA acha que coletou o suficiente
 *   }
 *
 * Modelo: claude-sonnet-4-6 com tool_use pra garantir formato.
 *
 * Estratégia:
 * - Se regrasAtuais vazio (cadastro novo): IA tira dúvidas iterativas pra extrair
 *   o máximo de regras (min/max horas, FDS, feriado, etc).
 * - Se regrasAtuais preenchido (edição): IA mostra as regras atuais e ajusta com
 *   base no diálogo.
 */

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface RegrasHospital {
  maxPorSemana?: number;
  minFimDeSemana?: number;
  duracaoPlantao?: number;
  maxPorMes?: number;
  minHorasPorSemana?: number;
  maxHorasPorSemana?: number;
  maxFimDeSemana?: number;
  feriadoMultiplicador?: number;
  bonusFimDeSemana?: number;
  regrasLivres?: string[];
}

interface ParseBody {
  hospitalNome?: string;
  hospitalTipo?: 'publico' | 'privado';
  mensagens?: ChatMsg[];
  regrasAtuais?: RegrasHospital;
}

const MODELO = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

const TOOL_DEFINIR_REGRAS = {
  name: 'definir_regras',
  description:
    'Quando você tiver coletado informação suficiente pra estruturar as regras (ou se o usuário disse que terminou), chame esta ferramenta com os campos que conseguiu mapear. Campos não mapeáveis vão em regrasLivres como texto.',
  input_schema: {
    type: 'object',
    properties: {
      maxPorSemana: { type: 'number', description: 'plantões/semana máximo' },
      maxPorMes: { type: 'number', description: 'plantões/mês máximo' },
      minFimDeSemana: { type: 'number', description: 'FDS obrigatórios/mês' },
      maxFimDeSemana: { type: 'number', description: 'FDS máximo/mês' },
      duracaoPlantao: { type: 'number', description: 'duração padrão do plantão (h)' },
      minHorasPorSemana: { type: 'number', description: 'CLT · horas mín/sem' },
      maxHorasPorSemana: { type: 'number', description: 'horas máx/sem' },
      feriadoMultiplicador: { type: 'number', description: 'feriado paga × multiplicador' },
      bonusFimDeSemana: { type: 'number', description: 'FDS multiplicador (1.3 = +30%)' },
      regrasLivres: {
        type: 'array',
        items: { type: 'string' },
        description: 'regras que não couberam nos campos · texto livre',
      },
    },
  },
} as const;

function montarSystem(opts: {
  hospitalNome: string;
  hospitalTipo: 'publico' | 'privado';
  regrasAtuais?: RegrasHospital;
  primeiraMensagem: boolean;
}): string {
  const tipoLabel = opts.hospitalTipo === 'publico' ? 'público (CLT)' : 'privado';
  const temRegras =
    opts.regrasAtuais && Object.values(opts.regrasAtuais).some((v) => v !== undefined && v !== null);

  const linhas = [
    `Você está ajudando uma médica a estruturar as regras de plantão de "${opts.hospitalNome}" (tipo: ${tipoLabel}).`,
    '',
    'Tom: direto, conversacional, em português brasileiro coloquial. Use linguagem do dia-a-dia médico (plantão, FDS, noitinha, virar madrugada). Sentence-case minúsculo. Sem markdown, sem listas formais — frases curtas.',
    '',
    'Sua tarefa: coletar regras objetivas que vão alimentar o Montar (proposta de escala). Os campos que importam:',
    '- maxPorSemana, maxPorMes (limite de plantões)',
    '- minHorasPorSemana, maxHorasPorSemana (CLT principalmente)',
    '- minFimDeSemana, maxFimDeSemana (FDS obrigatório/máximo no mês)',
    '- duracaoPlantao (duração padrão · 12h é comum)',
    '- feriadoMultiplicador (ex: 2 se paga dobrado em feriado)',
    '- bonusFimDeSemana (ex: 1.3 se FDS paga +30%)',
    '- regrasLivres: texto pra regras que não cabem nos campos acima',
  ];

  if (opts.primeiraMensagem && !temRegras) {
    linhas.push(
      '',
      'CONTEXTO: é a primeira vez que essa médica cadastra esse hospital. Nenhuma regra estruturada ainda.',
      '',
      'COMPORTAMENTO:',
      '- Comece se apresentando rapidamente e fazendo UMA pergunta direta de cada vez (não bombardeie).',
      '- Pergunte primeiro o essencial: quantos plantões por semana/mês, FDS obrigatórios.',
      '- Depois pergunte sobre feriado, bônus de FDS, e se tem alguma regra "esquisita" do hospital.',
      '- Quando achar que coletou o suficiente OU o usuário sinalizar que terminou, CHAME a ferramenta `definir_regras` com os valores mapeados.',
      '- Se o usuário responder com algo vago ou incerto, pergunte de novo de outro jeito.',
    );
  } else {
    linhas.push(
      '',
      `CONTEXTO: regras já cadastradas: ${JSON.stringify(opts.regrasAtuais ?? {}, null, 2)}`,
      '',
      'COMPORTAMENTO:',
      '- A médica está editando ou ajustando regras existentes.',
      '- Trate cada mensagem como solicitação de mudança específica.',
      '- Quando tiver uma proposta clara de novas regras, CHAME `definir_regras` com o resultado final (mantendo os campos atuais não mencionados).',
    );
  }

  return linhas.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const body = (req.body ?? {}) as ParseBody;
  const { hospitalNome, hospitalTipo, mensagens, regrasAtuais } = body;

  if (!hospitalNome || !hospitalTipo || !mensagens || mensagens.length === 0) {
    res.status(400).json({
      erro: 'payload incompleto · hospitalNome, hospitalTipo, mensagens obrigatórios',
    });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const primeiraMensagem = mensagens.length === 1 && mensagens[0]?.role === 'user';

  const system = montarSystem({
    hospitalNome,
    hospitalTipo,
    regrasAtuais,
    primeiraMensagem,
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
        system,
        tools: [TOOL_DEFINIR_REGRAS],
        messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('regras-parse: anthropic falhou', resp.status, txt);
      res.status(502).json({ erro: `anthropic ${resp.status}`, detalhe: txt.slice(0, 400) });
      return;
    }

    const json = (await resp.json()) as {
      content?: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; name: string; input: Record<string, unknown> }
      >;
      stop_reason?: string;
    };

    const textoResp = json.content?.find((c) => c.type === 'text');
    const toolCall = json.content?.find(
      (c): c is { type: 'tool_use'; name: string; input: Record<string, unknown> } =>
        c.type === 'tool_use' && c.name === 'definir_regras',
    );

    res.status(200).json({
      resposta:
        (textoResp && textoResp.type === 'text' ? textoResp.text : '') ||
        (toolCall ? 'beleza, montei as regras com o que você me contou — confere?' : ''),
      regrasPropostas: toolCall?.input ?? null,
      concluido: !!toolCall,
    });
  } catch (err) {
    console.error('regras-parse: exceção', err);
    res.status(500).json({ erro: 'algo travou aqui · tenta de novo' });
  }
}
