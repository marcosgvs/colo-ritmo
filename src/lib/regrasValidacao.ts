import type { RegrasHospital } from '@/types';

export interface AvisoRegra {
  campo: string;
  texto: string;
  /** 'erro' = bloqueia; 'aviso' = só alerta visualmente. */
  severidade: 'aviso' | 'erro';
}

/**
 * Detecta inconsistências em regras de hospital propostas pelo chat de IA
 * ou cadastradas direto. Foco em bugs reais que aconteceram em produção:
 *
 *   - "30h FDS por semana" → impossível (FDS tem 48h max), provavelmente
 *     era "por mês".
 *   - "200h/sem" → impossível (semana tem 168h).
 *
 * Não bloqueia salvar · só oferece o aviso pro user decidir.
 */
export function validarRegras(r: Partial<RegrasHospital>): AvisoRegra[] {
  const avisos: AvisoRegra[] = [];

  if (r.minHorasPorSemana != null && r.minHorasPorSemana > 168) {
    avisos.push({
      campo: 'minHorasPorSemana',
      texto: `${r.minHorasPorSemana}h/sem é impossível · semana tem só 168h. confere se não era /mês.`,
      severidade: 'erro',
    });
  }
  if (r.maxHorasPorSemana != null && r.maxHorasPorSemana > 168) {
    avisos.push({
      campo: 'maxHorasPorSemana',
      texto: `${r.maxHorasPorSemana}h/sem é impossível · semana tem só 168h. confere se não era /mês.`,
      severidade: 'erro',
    });
  }
  if (r.minHorasPorSemana != null && r.minHorasPorSemana > 80) {
    avisos.push({
      campo: 'minHorasPorSemana',
      texto: `${r.minHorasPorSemana}h/sem é muito alto · médicos no Brasil normalmente fazem até 60-80h/sem. confere se não era /mês.`,
      severidade: 'aviso',
    });
  }
  if (r.maxHorasPorSemana != null && r.maxHorasPorSemana > 100) {
    avisos.push({
      campo: 'maxHorasPorSemana',
      texto: `máximo de ${r.maxHorasPorSemana}h/sem é alto · confere se não era /mês.`,
      severidade: 'aviso',
    });
  }

  if (r.minHorasPorFimDeSemana != null && r.minHorasPorFimDeSemana > 48) {
    avisos.push({
      campo: 'minHorasPorFimDeSemana',
      texto: `${r.minHorasPorFimDeSemana}h em FDS/mês > 48h é improvável · um FDS tem só 48h. confere se a unidade tá certa.`,
      severidade: 'aviso',
    });
  }
  if (r.maxHorasPorFimDeSemana != null && r.maxHorasPorFimDeSemana > 96) {
    avisos.push({
      campo: 'maxHorasPorFimDeSemana',
      texto: `máx ${r.maxHorasPorFimDeSemana}h em FDS/mês é improvável · mês tem ~4 FDS = 192h. confere a unidade.`,
      severidade: 'aviso',
    });
  }

  if (r.duracaoMaximaDia != null && r.duracaoMaximaDia > 24) {
    avisos.push({
      campo: 'duracaoMaximaDia',
      texto: `${r.duracaoMaximaDia}h por dia é impossível · dia tem 24h.`,
      severidade: 'erro',
    });
  }

  if (r.minHorasPorMes != null && r.minHorasPorMes > 744) {
    avisos.push({
      campo: 'minHorasPorMes',
      texto: `${r.minHorasPorMes}h/mês é impossível · mês tem ~744h totais.`,
      severidade: 'erro',
    });
  }

  if (
    r.minHorasPorSemana != null &&
    r.maxHorasPorSemana != null &&
    r.minHorasPorSemana > r.maxHorasPorSemana
  ) {
    avisos.push({
      campo: 'minHorasPorSemana',
      texto: `mínimo (${r.minHorasPorSemana}h/sem) é maior que o máximo (${r.maxHorasPorSemana}h/sem) · confere.`,
      severidade: 'erro',
    });
  }
  if (
    r.minHorasPorMes != null &&
    r.maxHorasPorMes != null &&
    r.minHorasPorMes > r.maxHorasPorMes
  ) {
    avisos.push({
      campo: 'minHorasPorMes',
      texto: `mínimo (${r.minHorasPorMes}h/mês) é maior que o máximo (${r.maxHorasPorMes}h/mês) · confere.`,
      severidade: 'erro',
    });
  }

  // Regras livres com pistas de unidade trocada
  for (const livre of r.regrasLivres ?? []) {
    const baixo = livre.toLowerCase();
    const ehFDS = /fds|fim de semana|fim-de-semana|sábado|domingo|sabado/i.test(livre);
    const ehSem = /\/sem|por sem|semana/i.test(livre) && !/por mês|\/mês|mensal/i.test(livre);
    const numMatch = baixo.match(/(\d{2,3})\s*h/);
    const num = numMatch ? parseInt(numMatch[1] ?? '0', 10) : 0;
    if (ehFDS && ehSem && num >= 24) {
      avisos.push({
        campo: 'regrasLivres',
        texto: `"${livre}" · ${num}h em FDS por semana é improvável (FDS tem 48h). você quis dizer por mês?`,
        severidade: 'aviso',
      });
    }
  }

  return avisos;
}
