# Dia a dia de outubro/2026 — quatro formatos

Fonte: o Sheet vivo da escalista ("Escala UTI HCB 2026 · V5"), lido em 02/09 às 23h47.
Só leitura: nada foi escrito na planilha dela.

Regerar tudo:

    python3 export_dia_a_dia.py ler   # novo snapshot do Sheet
    python3 export_dia_a_dia.py       # gera os arquivos
    python3 gerar_painel4.py          # gera o painel interativo

| # | arquivo | o que é |
|---|---------|---------|
| 1 | `1 · dia a dia · como está` (.xlsx .docx .pdf .html) | a aba OUT · DIA A DIA como ela é hoje: uma linha por dia, os nomes de cada turno na célula, BHN em coluna própria, cobertura no fim |
| 2 | `2 · dia a dia · como mandam` (.xlsx .docx .pdf .html) | a grade que o hospital distribui, com o vermelho, o amarelo e o azul do arquivo original: blocos por dia, um nome por linha, colunas Manhã/Tarde/Noite/Noitinha |
| 3 | `3 · dia a dia · impresso` (.pdf .html) | desenhado para imprimir: uma página por semana civil, paisagem, o dia como coluna e os turnos como faixas, cobertura no pé |
| 4 | `4 · dia a dia · painel` (.html) | interativo: busca por médico, calendário do mês com a lotação de cada turno contra o mínimo, clique no dia abre os nomes |

Os PDFs saem do Chrome headless: texto vetorial, fontes embedadas, pesquisável.

Convenções em todos: **BHP** é plantão a mais (banco de horas) e vem colado no nome;
**BHN** é dispensa paga pelo banco e aparece no rodapé do dia; 28–30/09 e 01/11 entram
porque a semana civil fecha no domingo.
