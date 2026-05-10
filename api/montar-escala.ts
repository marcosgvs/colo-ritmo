import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from './_shared/env.js';
import { fuzzyMatch } from '../src/lib/fuzzyMatch.js';

/**
 * /api/montar-escala · gera proposta de escala via Claude com tool_use.
 *
 * Princípios:
 *   - Cada plantão pertence a UM hospital. As regras de um hospital
 *     APENAS valem pros plantões desse hospital. NUNCA herda de outro.
 *   - 5 insumos: regras contratuais · preferências · padrão do chefe
 *     (das escalas importadas) · histórico real dela (dos blocos
 *     passados) · bloqueios do mês alvo.
 *   - 3 lentes: descansar / equilibrar / ganhar · cada uma é um trecho
 *     de prompt diferente.
 *
 * Body:
 *   {
 *     ano, mes, lente,
 *     metaOverride?,
 *     hospitais: Hospital[],
 *     preferencias: Preferencias,
 *     escalasImportadas: EscalaImportada[],  // já filtradas aos hospitais incluídos
 *     blocos: Bloco[],                        // todos · servidor filtra
 *   }
 *
 * Resposta:
 *   {
 *     plantoes: Array<{ data, hospitalId, horaInicio, duracao, razao? }>,
 *     justificativa: string,
 *     totalEstimadoLiquido: number,
 *     avisos: string[],
 *     respostaCrua?: string,
 *   }
 */

interface Janela {
  rotulo: string;
  inicio: number;
  duracao: number;
}

interface RegrasHospital {
  maxPorSemana?: number;
  maxPorMes?: number;
  minFimDeSemana?: number;
  maxFimDeSemana?: number;
  minHorasPorFimDeSemana?: number;
  maxHorasPorFimDeSemana?: number;
  minHorasPorSemana?: number;
  maxHorasPorSemana?: number;
  minHorasPorMes?: number;
  maxHorasPorMes?: number;
  duracaoPlantao?: number;
  duracaoMaximaDia?: number;
  feriadoMultiplicador?: number;
  bonusFimDeSemana?: number;
  regrasLivres?: string[];
}

interface Hospital {
  id: string;
  nome: string;
  abrev: string;
  tipo: 'publico' | 'privado';
  valorPlantao: number;
  valorHora?: number;
  valorFixo?: number;
  adicionalNoite: number;
  regras: RegrasHospital;
  janelas?: Janela[];
}

interface Preferencias {
  nome: string;
  metaMensal: number;
  diasPreferidos?: string[];
  diasEvitar?: string[];
  hospitaisPreferidos?: string[];
  evitar24hCorrido?: boolean;
  maxPlantoesPorSemana?: number;
  janelaPreferida?: 'dia' | 'noite' | 'mista';
}

interface CelulaEscala {
  data: string;
  turno: string;
  nomes: string[];
}

interface EscalaImportada {
  hospitalId: string;
  ano: number;
  mes: number;
  importadaEm: string;
  janelas: Janela[];
  celulas: CelulaEscala[];
  apelidoUsado?: string;
}

interface Bloco {
  id: string | number;
  tipo: string;
  hospitalId?: string;
  data: string;
  horaInicio: number;
  duracao: number;
  viaTroca?: boolean;
}

interface MontarBody {
  ano?: number;
  mes?: number;
  lente?: 'descansar' | 'equilibrar' | 'ganhar';
  metaOverride?: number;
  hospitais?: Hospital[];
  preferencias?: Preferencias;
  escalasImportadas?: EscalaImportada[];
  blocos?: Bloco[];
}

interface PlantaoOutput {
  data: string;
  hospitalId: string;
  horaInicio: number;
  duracao: number;
  razao?: string;
}

interface ToolInput {
  plantoes?: PlantaoOutput[];
  justificativa?: string;
  totalEstimadoLiquido?: number;
  avisos?: string[];
}

const MODELO = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

const FERRAMENTA = {
  name: 'propor_escala',
  description:
    'Propõe uma escala de plantões respeitando as regras de cada hospital, as preferências da médica e os bloqueios já marcados.',
  input_schema: {
    type: 'object',
    properties: {
      plantoes: {
        type: 'array',
        description:
          'Lista de plantões propostos. Cada plantão pertence a UM hospital · use as regras DESSE hospital apenas.',
        items: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'YYYY-MM-DD dentro do mês alvo',
            },
            hospitalId: {
              type: 'string',
              description: 'um dos IDs cadastrados pelo usuário (lista no prompt)',
            },
            horaInicio: {
              type: 'number',
              description: 'hora de início decimal · use uma das janelas cadastradas do hospital',
            },
            duracao: {
              type: 'number',
              description: 'duração em horas · igual à da janela escolhida',
            },
            razao: {
              type: 'string',
              description: '1 frase curta · por que esse plantão entrou',
            },
          },
          required: ['data', 'hospitalId', 'horaInicio', 'duracao'],
        },
      },
      justificativa: {
        type: 'string',
        description:
          'Português padrão (capitalização correta · NÃO minúsculo). 2-4 frases. Explica a estratégia escolhida e como respeita as regras de cada hospital.',
      },
      totalEstimadoLiquido: {
        type: 'number',
        description: 'Estimativa do líquido em R$ do mês todo.',
      },
      avisos: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Trade-offs ou alertas relevantes pra médica (ex: "ficou abaixo da meta", "duas semanas com 3 plantões").',
      },
    },
    required: ['plantoes', 'justificativa', 'totalEstimadoLiquido'],
  },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const body = (req.body ?? {}) as MontarBody;
  const { ano, mes, lente, metaOverride, hospitais, preferencias, escalasImportadas, blocos } = body;

  if (!ano || !mes || !lente || !hospitais || hospitais.length === 0 || !preferencias) {
    res.status(400).json({ erro: 'payload incompleto · ano, mes, lente, hospitais, preferencias obrigatórios' });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const prompt = montarPrompt({
    ano,
    mes,
    lente,
    metaEfetiva: metaOverride ?? preferencias.metaMensal,
    hospitais,
    preferencias,
    escalasImportadas: escalasImportadas ?? [],
    blocos: blocos ?? [],
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('montar-escala: anthropic falhou', resp.status, txt);
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
        plantoes: [],
        justificativa: '',
        totalEstimadoLiquido: 0,
        avisos: ['o modelo não retornou no formato esperado · veja o que recebi e tenta de novo'],
        respostaCrua: texto || '(resposta vazia)',
      });
      return;
    }

    const inp = tool.input as ToolInput;
    const todosPlantoes = (inp.plantoes ?? []).map((p) => ({
      data: String(p.data),
      hospitalId: String(p.hospitalId),
      horaInicio: Number(p.horaInicio),
      duracao: Number(p.duracao),
      razao: p.razao ? String(p.razao) : undefined,
    }));

    // Validação server-side: remove plantões que sobrepõem bloqueios (modelo
    // às vezes "racionaliza" certo na razão mas mantém o plantão mesmo assim).
    const bloqueiosCheck = (blocos ?? []).filter(
      (b) => b.tipo !== 'plantao' && b.tipo !== 'cedido',
    );
    const removidos: string[] = [];
    const plantoesValidos = todosPlantoes.filter((p) => {
      const conflito = bloqueiosCheck.find((b) =>
        intervalosSobrepoem(b.data, b.horaInicio, b.duracao, p.data, p.horaInicio, p.duracao),
      );
      if (conflito) {
        const tipoBlock = conflito.tipo;
        const motivo =
          (conflito as { motivo?: string }).motivo ??
          (conflito as { detalhe?: string }).detalhe ??
          (conflito as { titulo?: string }).titulo ??
          tipoBlock;
        removidos.push(
          `plantão de ${p.data} ${p.horaInicio}h-${(p.horaInicio + p.duracao) % 24}h removido · sobrepõe bloqueio "${motivo}"`,
        );
        return false;
      }
      return true;
    });

    const avisosFinais = [...(inp.avisos ?? []), ...removidos];

    res.status(200).json({
      plantoes: plantoesValidos,
      justificativa: String(inp.justificativa ?? ''),
      totalEstimadoLiquido: Number(inp.totalEstimadoLiquido ?? 0),
      avisos: avisosFinais,
    });
  } catch (err) {
    console.error('montar-escala: exceção', err);
    res.status(500).json({ erro: 'algo travou aqui · tenta de novo' });
  }
}

// --- Prompt -----------------------------------------------------------------

function montarPrompt(opts: {
  ano: number;
  mes: number;
  lente: 'descansar' | 'equilibrar' | 'ganhar';
  metaEfetiva: number;
  hospitais: Hospital[];
  preferencias: Preferencias;
  escalasImportadas: EscalaImportada[];
  blocos: Bloco[];
}): string {
  const mesPad = String(opts.mes).padStart(2, '0');
  const mesISO = `${opts.ano}-${mesPad}`;
  const inicio = `${mesISO}-01`;
  const fim = ultimoDiaDoMes(opts.ano, opts.mes);
  const diaUm = diaDaSemana(opts.ano, opts.mes, 1);

  // Bloqueios no mês alvo (não-plantão · sono, bloqueio, consulta, etc)
  const bloqueiosDoMes = opts.blocos.filter(
    (b) => b.tipo !== 'plantao' && b.tipo !== 'cedido' && b.data >= inicio && b.data <= fim,
  );

  // Plantões já existentes no mês alvo (não devemos sobrescrever ou duplicar)
  const plantoesJaNoMesAlvo = opts.blocos.filter(
    (b) => b.tipo === 'plantao' && b.data >= inicio && b.data <= fim,
  );

  // Histórico: plantões dos últimos 6 meses por hospital
  const hojeMenos6 = adicionaMesesISO(`${mesISO}-01`, -6);
  const historicoPorHospital = new Map<string, Bloco[]>();
  for (const b of opts.blocos) {
    if (b.tipo !== 'plantao' || !b.hospitalId) continue;
    if (b.data < hojeMenos6 || b.data >= inicio) continue;
    const arr = historicoPorHospital.get(b.hospitalId) ?? [];
    arr.push(b);
    historicoPorHospital.set(b.hospitalId, arr);
  }

  const partes: string[] = [];

  partes.push(
    `Você está propondo uma escala de plantões para a médica ${opts.preferencias.nome} no mês de ${mesPad}/${opts.ano}.`,
    '',
    `O dia 1/${mesPad} é ${diaUm}-feira.`,
    `Meta financeira líquida do mês: R$ ${opts.metaEfetiva.toLocaleString('pt-BR')}.`,
    '',
    '## ESTRATÉGIA · ' + opts.lente.toUpperCase(),
    descricaoLente(opts.lente),
    '',
    '## REGRAS RÍGIDAS',
    '- Cada plantão pertence a UM hospital. Use SOMENTE as regras desse hospital pra esse plantão.',
    '- NUNCA aplique regras de um hospital nos plantões de outro.',
    '- Use APENAS as janelas (turnos) cadastradas pra cada hospital · não invente horários.',
    '- DURAÇÃO PADRÃO · prefira plantões com a `duracaoPlantao` cadastrada do hospital (geralmente 12h). Plantões partidos curtos (manhã 6h, tarde 6h) só quando indispensáveis pra cumprir uma regra obrigatória (ex: minHorasPorMes, minHorasPorFimDeSemana). Não use 6h só pra "encaixar mais um" — é irreal · não bate com a rotina.',
    '- BLOQUEIOS · não proponha plantão se o horário do plantão sobrepõe um bloqueio listado abaixo. Bloqueios podem ser parciais (ex: 14h-17h) · não invalidam o dia inteiro mas invalidam o turno que conflita. Se duracao do bloqueio é 24h, o dia inteiro está fora.',
    '- Não duplique plantão (mesmo dia + mesmo hospital + mesmo turno).',
    '- minFimDeSemana de um hospital significa que a médica DEVE fazer pelo menos N fins-de-semana COM PLANTÃO NESSE HOSPITAL no mês (em DIAS de FDS). Conte sábados E domingos · cada FDS conta uma vez se tiver pelo menos 1 plantão no sáb OU dom desse hospital. NÃO cumpra com plantão de outro hospital.',
    '- minHorasPorFimDeSemana é a soma de HORAS dos plantões que caem em sábado/domingo desse hospital. Cumpra somando duracao de plantões em FDS, não em DIAS.',
    '- minHorasPorMes · esse é OBRIGATÓRIO em hospitais públicos (CLT). Se você está abaixo, ADICIONE plantões até bater. Prefira esticar um plantão pra noite (12h) em vez de pegar 4 plantões partidos de 6h. Use partidos só quando 12h não cabe.',
    '- Se um campo de regra está em branco, não invente um valor "comum" — apenas ignore esse limite.',
    '',
  );

  // Hospitais — bloco por hospital, isolado
  partes.push('## HOSPITAIS DISPONÍVEIS');
  for (const h of opts.hospitais) {
    partes.push('');
    partes.push(`### ${h.abrev} · ${h.nome}`);
    partes.push(`id: \`${h.id}\` · tipo: ${h.tipo}`);

    // Janelas
    const janelas = h.janelas && h.janelas.length > 0 ? h.janelas : null;
    if (janelas) {
      partes.push(
        'Janelas (use uma destas):',
        ...janelas.map(
          (j) => `  - ${j.rotulo}: início ${j.inicio}, duração ${j.duracao}h`,
        ),
      );
    } else {
      partes.push('Janelas: não cadastradas · use razoavelmente: manhã (7-13, 6h), tarde (13-19, 6h), noite (19-7, 12h).');
    }

    // Valor
    const valorLinhas: string[] = [];
    if (h.valorFixo) valorLinhas.push(`valorFixo (CLT mensal): R$ ${h.valorFixo}`);
    if (h.valorHora) valorLinhas.push(`valorHora: R$ ${h.valorHora}`);
    if (!h.valorHora && h.valorPlantao) valorLinhas.push(`valorPlantao: R$ ${h.valorPlantao}`);
    valorLinhas.push(`adicionalNoite: R$ ${h.adicionalNoite}`);
    partes.push('Valor:', ...valorLinhas.map((l) => `  - ${l}`));

    // Regras
    const r = h.regras;
    const regraLinhas: string[] = [];
    if (r.maxPorSemana != null) regraLinhas.push(`máx ${r.maxPorSemana} plantões/semana`);
    if (r.maxPorMes != null) regraLinhas.push(`máx ${r.maxPorMes} plantões/mês`);
    if (r.minHorasPorSemana != null) regraLinhas.push(`mín ${r.minHorasPorSemana}h/sem`);
    if (r.maxHorasPorSemana != null) regraLinhas.push(`máx ${r.maxHorasPorSemana}h/sem`);
    if (r.minHorasPorMes != null) regraLinhas.push(`mín ${r.minHorasPorMes}h/mês`);
    if (r.maxHorasPorMes != null) regraLinhas.push(`máx ${r.maxHorasPorMes}h/mês`);
    if (r.minFimDeSemana != null) regraLinhas.push(`mín ${r.minFimDeSemana} FDS/mês (em dias)`);
    if (r.maxFimDeSemana != null) regraLinhas.push(`máx ${r.maxFimDeSemana} FDS/mês (em dias)`);
    if (r.minHorasPorFimDeSemana != null) regraLinhas.push(`mín ${r.minHorasPorFimDeSemana}h em FDS/mês`);
    if (r.maxHorasPorFimDeSemana != null) regraLinhas.push(`máx ${r.maxHorasPorFimDeSemana}h em FDS/mês`);
    if (r.duracaoPlantao != null) regraLinhas.push(`plantão padrão ${r.duracaoPlantao}h`);
    if (r.duracaoMaximaDia != null) regraLinhas.push(`máx ${r.duracaoMaximaDia}h por dia`);
    if (r.feriadoMultiplicador != null && r.feriadoMultiplicador !== 1)
      regraLinhas.push(`feriado paga ${r.feriadoMultiplicador}×`);
    if (r.bonusFimDeSemana != null && r.bonusFimDeSemana !== 1)
      regraLinhas.push(`FDS paga ${r.bonusFimDeSemana}×`);
    if (regraLinhas.length === 0) {
      regraLinhas.push('nenhuma regra rígida cadastrada');
      const temEscalas = opts.escalasImportadas.some((e) => e.hospitalId === h.id);
      if (temEscalas) {
        regraLinhas.push(
          '→ ATENÇÃO: como não tem regras explícitas, use o "Padrão do chefe" e o "Histórico real" abaixo como guia principal. Imite os volumes e turnos típicos das escalas anteriores.',
        );
      }
    }
    partes.push('Regras contratuais:', ...regraLinhas.map((l) => `  - ${l}`));

    if (r.regrasLivres && r.regrasLivres.length > 0) {
      partes.push(
        'Outras regras (texto livre):',
        ...r.regrasLivres.map((l) => `  - ${l}`),
      );
    }

    // Histórico real da médica nesse hospital
    const hist = historicoPorHospital.get(h.id) ?? [];
    if (hist.length > 0) {
      const ordenado = [...hist].sort((a, b) => a.data.localeCompare(b.data));
      const summary = ordenado
        .slice(-30)
        .map((b) => {
          const d = new Date(`${b.data}T12:00:00`);
          const dow = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()] ?? '?';
          return `${b.data} (${dow}) ${b.horaInicio}h-${(b.horaInicio + b.duracao) % 24}h`;
        })
        .join(', ');
      partes.push(
        `Histórico real da médica nos últimos 6 meses (${hist.length} plantões):`,
        `  ${summary}`,
        '  → Use isso pra inferir o estilo dela nesse hospital (DOW preferido, turno preferido).',
      );
    } else {
      partes.push('Histórico nesse hospital: nenhum plantão passado.');
    }

    // Padrão do chefe · da intenção dele nas escalas oficiais importadas
    // (antes de trocas/cessões). Diferente do histórico real (acima),
    // que vem dos blocos depois das trocas. Aqui buscamos por fuzzyMatch
    // o apelidoUsado em cada célula.
    const escalasDesseHosp = opts.escalasImportadas.filter((e) => e.hospitalId === h.id);
    if (escalasDesseHosp.length > 0) {
      const linhasPadrao: string[] = [];
      for (const esc of escalasDesseHosp) {
        if (!esc.apelidoUsado) continue;
        const cellsMariana = esc.celulas.filter((c) =>
          c.nomes.some((n) => fuzzyMatch(n, esc.apelidoUsado!)),
        );
        if (cellsMariana.length === 0) continue;
        const ordenado = [...cellsMariana].sort(
          (a, b) => a.data.localeCompare(b.data) || a.turno.localeCompare(b.turno),
        );
        const itens = ordenado
          .map((c) => {
            const d = new Date(`${c.data}T12:00:00`);
            const dia = d.getDate();
            const dow = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()] ?? '?';
            return `dia ${dia} (${dow}) ${c.turno}`;
          })
          .join(', ');
        linhasPadrao.push(
          `  ${String(esc.mes).padStart(2, '0')}/${esc.ano}: ${itens}`,
        );
      }
      if (linhasPadrao.length > 0) {
        partes.push(
          `Padrão do chefe nas escalas oficiais importadas (intenção dele, antes de trocas):`,
          ...linhasPadrao,
          '  → Use isso pra entender em quais dias/turnos o chefe TENDE A ESCALAR essa médica.',
        );
      } else {
        partes.push(
          `Escalas oficiais importadas: ${escalasDesseHosp.length} mês(es), mas sem apelido confiável pra extrair padrão do chefe.`,
        );
      }
    }
  }

  // Preferências
  partes.push('', '## PREFERÊNCIAS DA MÉDICA');
  partes.push(`- Meta líquida: R$ ${opts.metaEfetiva.toLocaleString('pt-BR')}`);
  if (opts.preferencias.diasPreferidos && opts.preferencias.diasPreferidos.length > 0)
    partes.push(`- Dias preferidos: ${opts.preferencias.diasPreferidos.join(', ')}`);
  if (opts.preferencias.diasEvitar && opts.preferencias.diasEvitar.length > 0)
    partes.push(`- Dias a evitar: ${opts.preferencias.diasEvitar.join(', ')}`);
  if (opts.preferencias.hospitaisPreferidos && opts.preferencias.hospitaisPreferidos.length > 0)
    partes.push(`- Hospitais favoritos: ${opts.preferencias.hospitaisPreferidos.join(', ')}`);
  if (opts.preferencias.evitar24hCorrido) partes.push('- Evita 24h corridas (manhã+tarde+noite no mesmo dia).');
  if (opts.preferencias.maxPlantoesPorSemana)
    partes.push(`- Limite pessoal: máx ${opts.preferencias.maxPlantoesPorSemana} plantões/semana.`);
  if (opts.preferencias.janelaPreferida)
    partes.push(`- Janela preferida: ${opts.preferencias.janelaPreferida}`);

  // Bloqueios
  partes.push('', '## BLOQUEIOS NO MÊS ALVO');
  if (bloqueiosDoMes.length === 0) {
    partes.push('Nenhum.');
  } else {
    for (const b of bloqueiosDoMes) {
      partes.push(`- ${b.data} ${b.horaInicio}h-${(b.horaInicio + b.duracao) % 24}h (${b.tipo})`);
    }
  }

  // Plantões já confirmados no mês alvo (não duplicar)
  if (plantoesJaNoMesAlvo.length > 0) {
    partes.push('', '## JÁ CONFIRMADO NO MÊS ALVO (não duplicar, considere como contexto fixo)');
    for (const b of plantoesJaNoMesAlvo) {
      partes.push(`- ${b.data} ${b.horaInicio}h-${(b.horaInicio + b.duracao) % 24}h em ${b.hospitalId}`);
    }
  }

  partes.push(
    '',
    '## VALIDAÇÃO ANTES DE DEVOLVER',
    'Antes de chamar a ferramenta, faça essa checagem MENTAL pra cada hospital:',
    '1. Conte os plantões que você propôs nesse hospital · está dentro do `maxPorMes`?',
    '2. Conte DIAS de FDS (sábados+domingos) com plantão NESSE hospital · está atingindo `minFimDeSemana`?',
    '3. Some as HORAS dos plantões em FDS nesse hospital · está dentro de `minHorasPorFimDeSemana`/`maxHorasPorFimDeSemana`?',
    '4. Some as horas totais dos plantões nesse hospital · está dentro de `minHorasPorMes`/`maxHorasPorMes` e `minHorasPorSemana`/`maxHorasPorSemana`?',
    '5. Para cada `regrasLivres` em texto, leia e confira se a sua proposta atende.',
    '6. Para cada bloqueio listado · seu plantão proposto NÃO sobrepõe o horário do bloqueio?',
    'Se algum item NÃO bater, AJUSTE a proposta antes de chamar o tool. Regras contratuais (CLT) são OBRIGATÓRIAS, mesmo na lente "ganhar". Se a meta financeira só for batida violando uma regra, fica abaixo da meta E menciona no `avisos`.',
    '',
    '## INSTRUÇÕES DE SAÍDA',
    '1. Chame a ferramenta `propor_escala` com a lista completa de plantões propostos.',
    '2. Cada plantão deve ter `hospitalId` válido (um dos IDs cadastrados).',
    '3. Cada `horaInicio` e `duracao` deve bater EXATAMENTE com uma janela cadastrada do hospital.',
    '4. Adicione razão curta (1 frase) em cada plantão.',
    '5. Justificativa em Português padrão (não minúsculo) · 2-4 frases. Se uma regra contratual obrigou a ficar abaixo da meta, fala disso na justificativa.',
    '6. Estimativa de líquido considerando os valores cadastrados de cada hospital.',
    '7. Use `avisos` pra qualquer trade-off (ficou abaixo da meta, semana pesada, etc).',
  );

  return partes.join('\n');
}

function descricaoLente(lente: 'descansar' | 'equilibrar' | 'ganhar'): string {
  switch (lente) {
    case 'descansar':
      return [
        'Priorize descanso físico acima da meta financeira. A médica vem de um período pesado e precisa respirar.',
        '- Espace plantões com 2-3 dias entre eles.',
        '- Evite mais de 2 plantões na mesma semana.',
        '- Evite combinar tarde+noite no mesmo dia.',
        '- Evite plantões noturnos seguidos por plantões na mesma manhã/tarde do dia seguinte.',
        '- Aceite ficar abaixo da meta financeira se necessário · prefira descanso.',
      ].join('\n');
    case 'equilibrar':
      return [
        'Equilibre carga e remuneração. Sustentável a longo prazo.',
        '- Espace plantões com 1-2 dias entre eles na maioria das vezes.',
        '- Tente bater a meta sem ultrapassar muito.',
        '- Mistura turnos diurnos e noturnos.',
        '- Respeita recuperação após noite (12h sem plantão depois).',
      ].join('\n');
    case 'ganhar':
      return [
        'Maximiza a receita até a meta (e um pouco além se houver oportunidade clara) · MAS RESPEITA as regras contratuais de cada hospital, que são obrigatórias mesmo aqui (incluindo `minFimDeSemana`, `minHorasPorMes`, `regrasLivres`).',
        '- Pode espaçar só 1 dia entre plantões.',
        '- Prefere plantões noturnos / FDS quando o adicional vale a pena.',
        '- Pode passar da meta se for natural.',
        '- Respeita as regras rígidas dos hospitais mas vai no limite delas.',
      ].join('\n');
  }
}

function diaDaSemana(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getUTCDay()]!;
}

function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0));
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function adicionaMesesISO(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  if (a == null || m == null || d == null) return iso;
  const dt = new Date(Date.UTC(a, m - 1 + n, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Converte (data, horaInicio, duracao) em intervalo absoluto de timestamps
 * decimais (em horas desde epoch / 3600). Lida com duração que vira o dia
 * (ex: noite 19h+12h = 7h do dia seguinte).
 */
function intervaloAbs(data: string, horaInicio: number, duracao: number): { ini: number; fim: number } {
  const t = new Date(`${data}T00:00:00Z`).getTime() / 3_600_000;
  return { ini: t + horaInicio, fim: t + horaInicio + duracao };
}

function intervalosSobrepoem(
  dA: string,
  hA: number,
  durA: number,
  dB: string,
  hB: number,
  durB: number,
): boolean {
  const a = intervaloAbs(dA, hA, durA);
  const b = intervaloAbs(dB, hB, durB);
  return a.ini < b.fim && b.ini < a.fim;
}
