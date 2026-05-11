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
  hospitaisPreferidos?: string[];
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

type Lente = 'descansar' | 'equilibrar' | 'acelerar';

interface MontarBody {
  ano?: number;
  mes?: number;
  lente?: Lente;
  acelerarPercentual?: number;
  acelerarValor?: number;
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
  const { ano, mes, lente, acelerarPercentual, acelerarValor, hospitais, preferencias, escalasImportadas, blocos } = body;

  if (!ano || !mes || !lente || !hospitais || hospitais.length === 0 || !preferencias) {
    res.status(400).json({ erro: 'payload incompleto · ano, mes, lente, hospitais, preferencias obrigatórios' });
    return;
  }

  if (lente === 'acelerar' && !acelerarPercentual && !acelerarValor) {
    res.status(400).json({ erro: 'acelerar precisa de motivo · acelerarPercentual ou acelerarValor' });
    return;
  }

  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const prompt = montarPrompt({
    ano,
    mes,
    lente,
    acelerarPercentual,
    acelerarValor,
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

    // Validação numérica de horas/plantões/FDS por hospital · servidor é a
    // fonte de verdade (modelo escreve estimativas que às vezes não batem
    // com soma real, ex: "138h" quando a soma é 150h).
    const validacaoLinhas = validarPorHospital(plantoesValidos, hospitais);

    const avisosFinais = [...(inp.avisos ?? []), ...removidos, ...validacaoLinhas];

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
  lente: Lente;
  acelerarPercentual?: number;
  acelerarValor?: number;
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

  // Baseline + diagnóstico de disfunção servem de contexto pro modelo entender
  // de onde a médica vem · não são bloqueios, são sinais que pesam na decisão.
  const baseline = computeBaseline(opts.blocos, mesISO);
  const disfuncao = computeDisfuncaoSignals(opts.blocos, mesISO);

  const partes: string[] = [];

  partes.push(
    `Você está propondo uma escala de plantões para a médica ${opts.preferencias.nome} no mês de ${mesPad}/${opts.ano}.`,
    '',
    `O dia 1/${mesPad} é ${diaUm}-feira.`,
    '',
    '## CONTEXTO DA MÉDICA',
  );

  if (baseline.suficiente) {
    partes.push(`- Volume base (média dos últimos ${baseline.mesesAmostra} meses): ~${baseline.avgPlantoesMes.toFixed(0)} plantões/mês.`);
  } else {
    partes.push(`- Histórico curto (${baseline.mesesAmostra} mês/meses com plantão) · sem baseline confiável de volume.`);
  }

  const sinais: string[] = [];
  if (disfuncao.sequenciasMaiores3 > 0) {
    sinais.push(`${disfuncao.sequenciasMaiores3} sequência(s) de 3+ plantões consecutivos nos últimos 90 dias (mais longa: ${disfuncao.diasMaiorSequencia} dias)`);
  }
  if (disfuncao.fdsCheios > 0) {
    const cons = disfuncao.fdsCheiosConsecutivos >= 2 ? ` (até ${disfuncao.fdsCheiosConsecutivos} consecutivos)` : '';
    sinais.push(`${disfuncao.fdsCheios} fim(ns) de semana totalmente trabalhado(s) nos últimos 90 dias${cons}`);
  }
  if (disfuncao.mesAnteriorPlantoes > 0) {
    sinais.push(`${disfuncao.mesAnteriorPlantoes} plantão(ões) no mês anterior`);
  }
  if (sinais.length > 0) {
    partes.push('- Carga recente: ' + sinais.join(' · '));
    partes.push('  → considere isso ao decidir o volume desse mês · médica vinda de mês pesado precisa de mais espaçamento');
  } else {
    partes.push('- Carga recente: sem sinais fortes de acúmulo.');
  }
  partes.push('');

  if (opts.lente === 'acelerar') {
    partes.push('## MÊS DE META · MÉDICA ESCOLHEU ACELERAR');
    const motivos: string[] = [];
    if (opts.acelerarPercentual && baseline.suficiente) {
      const alvo = Math.round(baseline.avgPlantoesMes * (1 + opts.acelerarPercentual / 100));
      motivos.push(`+${opts.acelerarPercentual}% sobre baseline · mire em ~${alvo} plantões esse mês`);
    } else if (opts.acelerarPercentual) {
      motivos.push(`+${opts.acelerarPercentual}% sobre baseline · MAS baseline insuficiente · use o valor R$ como alvo principal`);
    }
    if (opts.acelerarValor) {
      motivos.push(`chegar até R$ ${opts.acelerarValor.toLocaleString('pt-BR')} líquido`);
    }
    partes.push('Motivo: ' + motivos.join(' OU '));
    partes.push('Se as duas metas estão presentes, honre a MAIS DEMANDANTE. Use como justificativa pra forçar a régua até o LIMITE das regras contratuais — nunca além.');
    partes.push('');
  }

  partes.push(
    '## ESTRATÉGIA · ' + opts.lente.toUpperCase(),
    descricaoLente(opts.lente),
    '',
    '## METAS DE QUALIDADE DE VIDA · SOFT, MAS PESAM',
    '- Evite sequências de 3+ plantões consecutivos · acumulam fadiga real.',
    '- Pelo menos 1-2 fins de semana com folga no mês (descansar/equilibrar mira 2+, acelerar mira 1+).',
    '- Recuperação após plantão noturno (mínimo 12h sem plantão depois).',
    '- Distribua espaçamento entre plantões · não concentre tudo numa semana.',
    'Essas metas NÃO são bloqueios. Violações são aceitáveis quando justificadas pelo contexto, mas trate como tendência preferida e mencione em avisos quando violar.',
    '',
    '## REGRAS DURAS · NÃO VIOLE',
    '- Cada plantão pertence a UM hospital. Use SOMENTE as regras desse hospital pra esse plantão. NUNCA herde de outro.',
    '- Use APENAS as janelas (turnos) cadastradas pra cada hospital · não invente horários.',
    '- Regras contratuais (mín/máx horas, duracaoMaximaDia, regrasLivres) são GROUND TRUTH. Mesmo se o histórico da médica passa por cima delas, RESPEITE no que propor.',
    '- Bloqueios listados abaixo são absolutos · não proponha plantão sobrepondo. Bloqueios parciais (ex: 14h-17h) invalidam o turno conflitante mas não o dia inteiro.',
    '- Não duplique plantão (mesmo dia + mesmo hospital + mesmo turno).',
    '- minHorasPorFimDeSemana é a soma de HORAS dos plantões em sábado/domingo desse hospital. Cumpra somando duracao.',
    '- minHorasPorMes (típico em hospitais públicos CLT) é obrigatório · se está abaixo, ADICIONE plantões até bater.',
    '- DURAÇÃO · plantão de 12h é a jornada típica · partidos de 5-6h existem mas use com moderação · prefira completar 12h e usar partidos pra fechar gap de horas.',
    '- Se um campo de regra está em branco, IGNORE esse limite · não invente.',
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
    if (r.minHorasPorSemana != null) regraLinhas.push(`mín ${r.minHorasPorSemana}h/sem`);
    if (r.maxHorasPorSemana != null) regraLinhas.push(`máx ${r.maxHorasPorSemana}h/sem`);
    if (r.minHorasPorMes != null) regraLinhas.push(`mín ${r.minHorasPorMes}h/mês`);
    if (r.maxHorasPorMes != null) regraLinhas.push(`máx ${r.maxHorasPorMes}h/mês`);
    if (r.minHorasPorFimDeSemana != null) regraLinhas.push(`mín ${r.minHorasPorFimDeSemana}h em FDS/mês`);
    if (r.maxHorasPorFimDeSemana != null) regraLinhas.push(`máx ${r.maxHorasPorFimDeSemana}h em FDS/mês`);
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
  if (opts.preferencias.hospitaisPreferidos && opts.preferencias.hospitaisPreferidos.length > 0) {
    partes.push('', '## PREFERÊNCIAS DA MÉDICA');
    partes.push(`- Hospitais favoritos: ${opts.preferencias.hospitaisPreferidos.join(', ')}`);
  }

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
    '1. Some as HORAS dos plantões em FDS nesse hospital · está dentro de `minHorasPorFimDeSemana`/`maxHorasPorFimDeSemana`?',
    '2. Some as horas totais dos plantões nesse hospital · está dentro de `minHorasPorMes`/`maxHorasPorMes` e `minHorasPorSemana`/`maxHorasPorSemana`?',
    '3. Em algum dia tem turnos combinados que somam mais que `duracaoMaximaDia`?',
    '4. Para cada `regrasLivres` em texto, leia e confira se a sua proposta atende.',
    '5. Para cada bloqueio listado · seu plantão proposto NÃO sobrepõe o horário do bloqueio?',
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

function descricaoLente(lente: Lente): string {
  switch (lente) {
    case 'descansar':
      return [
        'A médica precisa respirar · prioriza descanso real acima de receita.',
        '- Mire em volume ABAIXO da média histórica (~70-80% do baseline).',
        '- Espace plantões 2-3 dias entre si.',
        '- Evite sequências de 3+ dias.',
        '- Pelo menos 2 fins de semana totalmente livres no mês.',
        '- Não pegue plantão na manhã/tarde do dia seguinte a um noturno.',
        '- Se cair abaixo do mínimo contratual, informe nos avisos.',
      ].join('\n');
    case 'equilibrar':
      return [
        'Mês saudável e sustentável · sem pressão extra.',
        '- Volume na média histórica · não force além.',
        '- Espace plantões 1-2 dias na maioria das vezes.',
        '- Pelo menos 1-2 fins de semana com folga.',
        '- Misture turnos diurnos e noturnos respeitando recuperação pós-noite (12h).',
        '- Respeite todas as regras contratuais sem violar.',
      ].join('\n');
    case 'acelerar':
      return [
        'Mês de meta · a médica marcou um motivo concreto pra forçar a régua. Empurre até o LIMITE DAS REGRAS CONTRATUAIS.',
        '- Pode espaçar plantões só 1 dia entre si.',
        '- Pode aceitar 2-3 plantões na mesma semana se for o caminho pra atingir.',
        '- Prefira plantões mais rentáveis (noturnos, FDS quando o adicional vale).',
        '- Pelo menos 1 fim de semana livre no mês · qualidade de vida não some mesmo aqui.',
        '- NUNCA viole regras contratuais (CLT, máximos do hospital) pra atingir. Se a meta exigir violação, fica abaixo dela E declara isso na justificativa e avisos.',
        '- Recuperação pós-noite (12h) não é negociável · vale mesmo na lente acelerar.',
      ].join('\n');
  }
}

// --- Análise de contexto da médica -----------------------------------------

interface BaselineInfo {
  avgPlantoesMes: number;
  mesesAmostra: number;
  suficiente: boolean;
}

function computeBaseline(blocos: Bloco[], mesISO: string): BaselineInfo {
  const inicio = `${mesISO}-01`;
  const inicioJanela = adicionaMesesISO(inicio, -6);
  const plantoes = blocos.filter(
    (b) => b.tipo === 'plantao' && b.data >= inicioJanela && b.data < inicio,
  );
  const mesesUnicos = new Set(plantoes.map((b) => b.data.slice(0, 7)));
  const mesesAmostra = mesesUnicos.size;
  const avgPlantoesMes = mesesAmostra > 0 ? plantoes.length / mesesAmostra : 0;
  return {
    avgPlantoesMes,
    mesesAmostra,
    suficiente: mesesAmostra >= 3,
  };
}

interface DisfuncaoSignals {
  sequenciasMaiores3: number;
  diasMaiorSequencia: number;
  fdsCheios: number;
  fdsCheiosConsecutivos: number;
  mesAnteriorPlantoes: number;
}

function computeDisfuncaoSignals(blocos: Bloco[], mesISO: string): DisfuncaoSignals {
  const inicio = `${mesISO}-01`;
  const inicioJanela = adicionaMesesISO(inicio, -3); // últimos ~90 dias
  const datasPlantao = Array.from(
    new Set(
      blocos
        .filter((b) => b.tipo === 'plantao' && b.data >= inicioJanela && b.data < inicio)
        .map((b) => b.data),
    ),
  ).sort();

  let sequenciasMaiores3 = 0;
  let diasMaiorSequencia = 0;
  let atual = datasPlantao.length > 0 ? 1 : 0;
  for (let i = 1; i < datasPlantao.length; i++) {
    const prev = new Date(`${datasPlantao[i - 1]}T00:00:00Z`);
    const cur = new Date(`${datasPlantao[i]}T00:00:00Z`);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      atual++;
    } else {
      if (atual >= 3) sequenciasMaiores3++;
      if (atual > diasMaiorSequencia) diasMaiorSequencia = atual;
      atual = 1;
    }
  }
  if (atual >= 3) sequenciasMaiores3++;
  if (atual > diasMaiorSequencia) diasMaiorSequencia = atual;

  const fdsPorSemana = new Map<string, Set<number>>();
  for (const d of datasPlantao) {
    const dt = new Date(`${d}T12:00:00Z`);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) continue;
    const iso = isoWeek(dt);
    const set = fdsPorSemana.get(iso) ?? new Set<number>();
    set.add(dow);
    fdsPorSemana.set(iso, set);
  }
  const semanasFdsCheio: string[] = [];
  for (const [iso, set] of fdsPorSemana) {
    if (set.has(0) && set.has(6)) semanasFdsCheio.push(iso);
  }
  semanasFdsCheio.sort();
  const fdsCheios = semanasFdsCheio.length;

  let fdsCheiosConsecutivos = 0;
  let run = fdsCheios > 0 ? 1 : 0;
  for (let i = 1; i < semanasFdsCheio.length; i++) {
    if (isoWeekNext(semanasFdsCheio[i - 1]!) === semanasFdsCheio[i]) {
      run++;
    } else {
      if (run > fdsCheiosConsecutivos) fdsCheiosConsecutivos = run;
      run = 1;
    }
  }
  if (run > fdsCheiosConsecutivos) fdsCheiosConsecutivos = run;

  const inicioMesAnt = adicionaMesesISO(inicio, -1);
  const plantoesMesAnt = blocos.filter(
    (b) => b.tipo === 'plantao' && b.data >= inicioMesAnt && b.data < inicio,
  );

  return {
    sequenciasMaiores3,
    diasMaiorSequencia,
    fdsCheios,
    fdsCheiosConsecutivos,
    mesAnteriorPlantoes: plantoesMesAnt.length,
  };
}

function isoWeek(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function isoWeekNext(iso: string): string {
  const [yearStr, wkStr] = iso.split('-W');
  const year = parseInt(yearStr!, 10);
  const wk = parseInt(wkStr!, 10);
  if (wk < 52) return `${year}-W${String(wk + 1).padStart(2, '0')}`;
  return `${year + 1}-W01`;
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

/**
 * Soma horas/plantões/FDS por hospital e compara com as regras cadastradas.
 * Retorna linhas de aviso (vazio se tudo passa). Servidor é a fonte de
 * verdade · não confia na estimativa do modelo.
 */
function validarPorHospital(
  plantoes: Array<{ hospitalId: string; data: string; horaInicio: number; duracao: number }>,
  hospitais: Hospital[],
): string[] {
  const avisos: string[] = [];
  for (const h of hospitais) {
    const meus = plantoes.filter((p) => p.hospitalId === h.id);
    if (meus.length === 0 && Object.keys(h.regras ?? {}).length === 0) continue;

    const totalH = meus.reduce((s, p) => s + p.duracao, 0);
    const totalN = meus.length;

    // FDS: sábado(6) ou domingo(0) em JS getUTCDay
    const dowSet = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    const isFDS = (d: string) => {
      const w = dowSet(d);
      return w === 0 || w === 6;
    };
    const fdsPlantoes = meus.filter((p) => isFDS(p.data));
    const horasFDS = fdsPlantoes.reduce((s, p) => s + p.duracao, 0);
    const diasFDSUnicos = new Set(fdsPlantoes.map((p) => p.data)).size;

    const linhas: string[] = [];
    const r = h.regras ?? {};

    linhas.push(`${h.abrev ?? h.nome}: ${totalN} plantões · ${totalH}h · ${horasFDS}h em FDS (${diasFDSUnicos} dias)`);

    if (r.minHorasPorMes != null && totalH < r.minHorasPorMes)
      linhas.push(`  ⚠ ${totalH}h abaixo de minHorasPorMes=${r.minHorasPorMes}`);
    if (r.maxHorasPorMes != null && totalH > r.maxHorasPorMes)
      linhas.push(`  ⚠ ${totalH}h acima de maxHorasPorMes=${r.maxHorasPorMes}`);
    if (r.minHorasPorFimDeSemana != null && horasFDS < r.minHorasPorFimDeSemana)
      linhas.push(`  ⚠ ${horasFDS}h em FDS abaixo de minHorasPorFimDeSemana=${r.minHorasPorFimDeSemana}`);
    if (r.maxHorasPorFimDeSemana != null && horasFDS > r.maxHorasPorFimDeSemana)
      linhas.push(`  ⚠ ${horasFDS}h em FDS acima de maxHorasPorFimDeSemana=${r.maxHorasPorFimDeSemana}`);

    avisos.push(linhas.join('\n'));
  }
  return avisos;
}
