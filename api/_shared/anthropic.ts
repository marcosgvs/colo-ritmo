/**
 * Traduz falha da API da Anthropic em mensagem curta pro usuário final.
 *
 * Contexto: "servidor não respondeu bem · 502" já confundiu diagnóstico —
 * o caso mais comum de 4xx aqui é crédito esgotado, que não adianta
 * "tentar de novo". A mensagem precisa dizer o que fazer.
 */
export function msgErroAnthropic(status: number, corpo: string): string {
  if (corpo.includes('credit balance')) {
    return 'créditos da leitura inteligente esgotados · avisa o suporte';
  }
  if (status === 429) {
    return 'muitas leituras ao mesmo tempo · espera um minuto e tenta de novo';
  }
  if (status === 401 || status === 403) {
    return 'leitura inteligente indisponível (acesso negado) · avisa o suporte';
  }
  if (status === 529 || status >= 500) {
    return 'serviço de leitura instável agora · tenta de novo em instantes';
  }
  return `leitura falhou (erro ${status}) · tenta de novo`;
}
