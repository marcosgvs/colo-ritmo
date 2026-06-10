import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';
import { msgErroAnthropic } from './_shared/anthropic.js';
import { userIdDoJwt } from './_shared/auth.js';
import { supabaseAdmin } from './_shared/supabaseAdmin.js';

/**
 * /api/regras-parse · conversa iterativa pra estruturar regras de plantão
 * de UM hospital específico.
 *
 * Princípios:
 *   - Cada hospital começa zerado · não usa padrões "comuns" / "típicos"
 *     herdados do treinamento do modelo nem de outros hospitais cadastrados.
 *   - Modelo só preenche campo quando o usuário declarou diretamente.
 *     Se o usuário não falou, o campo fica undefined · regra livre é o
 *     fallback pra o que não cabe no schema.
 *   - Modelo NUNCA converte horas em plantões nem vice-versa. "30h/sem"
 *     não vira "2 plantões/sem".
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
 *     resposta: string,
 *     regrasPropostas?: RegrasHospital,  // só presente quando IA chamou o tool
 *     concluido: boolean,
 *   }
 */

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface RegrasHospital {
  minHorasPorSemana?: number;
  maxHorasPorSemana?: number;
  minHorasPorMes?: number;
  maxHorasPorMes?: number;
  minHorasPorFimDeSemana?: number;
  maxHorasPorFimDeSemana?: number;
  duracaoMaximaDia?: number;
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
    'Chame esta ferramenta APENAS quando tiver coletado regras concretas que o usuário declarou. Preencha SOMENTE os campos que o usuário falou explicitamente. Campos não mencionados ficam undefined. Não invente, não sugira valores "comuns".',
  input_schema: {
    type: 'object',
    properties: {
      minHorasPorFimDeSemana: {
        type: 'number',
        description:
          'Mínimo de HORAS de plantão em fins-de-semana por mês. Use quando o usuário fala "X horas em FDS por mês".',
      },
      maxHorasPorFimDeSemana: {
        type: 'number',
        description: 'Máximo de horas de plantão em fins-de-semana por mês.',
      },
      minHorasPorSemana: {
        type: 'number',
        description:
          'Mínimo de horas de plantão por semana exigidas pelo contrato.',
      },
      maxHorasPorSemana: {
        type: 'number',
        description: 'Máximo de horas de plantão permitidas por semana.',
      },
      minHorasPorMes: {
        type: 'number',
        description: 'Mínimo de horas de plantão por mês exigidas pelo contrato.',
      },
      maxHorasPorMes: {
        type: 'number',
        description: 'Máximo de horas de plantão permitidas por mês.',
      },
      duracaoMaximaDia: {
        type: 'number',
        description:
          'Total máximo de horas de plantão permitidas em UM dia (somando turnos combinados). Aplicável quando o hospital permite combinar manhã+tarde, tarde+noite, etc.',
      },
      feriadoMultiplicador: {
        type: 'number',
        description:
          'Multiplicador de pagamento em feriado (1.0 = sem bônus, 2.0 = paga em dobro). Só preencha se o usuário disser explicitamente.',
      },
      bonusFimDeSemana: {
        type: 'number',
        description:
          'Multiplicador adicional pra plantão de FDS (1.0 = sem bônus, 1.3 = +30%). Só preencha se o usuário disser explicitamente.',
      },
      regrasLivres: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Regras descritas pelo usuário que não casam com nenhum dos campos acima. Mantenha em texto curto e direto.',
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
    'REGRA DURA · NÃO INVENTE',
    '- Se o usuário NÃO falou de um campo, deixe ele undefined. Não preencha com valores "comuns" ou "típicos".',
    '- Cada hospital tem suas próprias regras. Você NÃO usa padrões de outros hospitais.',
    '- Se o usuário diz "geralmente", "normalmente", "uma média", PERGUNTE se é regra rígida antes de mapear como número fixo.',
    '- NÃO converta horas em plantões nem o contrário. "30h/sem" não vira "2 plantões/sem".',
    '',
    'MAPEAMENTO · usuário fala em → você usa',
    '- "X horas por semana" → pergunte se é mín ou máx → minHorasPorSemana ou maxHorasPorSemana',
    '- "X horas por mês" → pergunte se é mín ou máx → minHorasPorMes ou maxHorasPorMes',
    '- "X horas em FDS por mês" (mín ou máx) → minHorasPorFimDeSemana=X ou maxHorasPorFimDeSemana=X (pergunte qual)',
    '- "máximo de Z horas combinadas no dia" / "não pode pegar dois plantões seguidos" → duracaoMaximaDia=Z',
    '- "feriado paga em dobro" → feriadoMultiplicador=2',
    '- "FDS paga +X%" → bonusFimDeSemana=(1 + X/100)',
    '- Qualquer regra que não casa com campo (ex: "X plantões por semana", "Y FDS obrigatórios em dias", "duração X de plantão") → regrasLivres como texto curto',
    '',
    'TOM · português brasileiro coloquial, sentence-case minúsculo, sem markdown, frases curtas. Use linguagem do dia-a-dia médico (plantão, FDS, noitinha, virar madrugada).',
  ];

  if (opts.primeiraMensagem && !temRegras) {
    linhas.push(
      '',
      'CONTEXTO · primeira vez que essa médica cadastra esse hospital. Nenhuma regra estruturada ainda.',
      '',
      'COMPORTAMENTO',
      '- Comece se apresentando rapidamente e fazendo UMA pergunta direta de cada vez (não bombardeie).',
      '- Pergunte primeiro o essencial pra ela: o que de mais rígido o contrato/equipe define (limites de plantão ou horas, FDS obrigatórios).',
      '- Quando ela declarar algo numérico, espelhe pra confirmar antes de salvar (ex: "30h/sem · isso é mínimo do contrato ou máximo que você não quer passar?").',
      '- Quando achar que coletou o suficiente OU o usuário sinalizar que terminou, CHAME a ferramenta `definir_regras` com APENAS os campos que ela declarou.',
      '- Se ela responder com algo vago ou incerto, pergunte de novo de outro jeito · nunca preencha por adivinhação.',
    );
  } else {
    linhas.push(
      '',
      `CONTEXTO · regras já cadastradas pra esse hospital: ${JSON.stringify(opts.regrasAtuais ?? {}, null, 2)}`,
      '',
      'COMPORTAMENTO',
      '- A médica está editando ou ajustando regras existentes desse hospital.',
      '- Trate cada mensagem como solicitação de mudança específica.',
      '- Quando tiver uma proposta clara de novas regras, CHAME `definir_regras` com o resultado final · mantém os campos atuais não mencionados, atualiza os mencionados.',
    );
  }

  return linhas.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  // Endpoint consome créditos da Anthropic · só user logado pode chamar.
  const userId = await userIdDoJwt(req, supabaseAdmin());
  if (!userId) {
    res.status(401).json({ erro: 'sessão expirada · entra de novo e tenta outra vez' });
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
      res.status(502).json({ erro: msgErroAnthropic(resp.status, txt), detalhe: txt.slice(0, 400) });
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
