#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Correções da CHECAGEM de outubro (e-mail de Marcos/Mari, 28/08+), aplicadas
POR CIMA da versão viva da Mari (mari_out_dados.py v2, re-transcrita em 01/09/26).

Cada linha: (item do e-mail, apelido, dia, código anterior, código novo, motivo).
dia 32 = 01/11. Código "" = célula vazia. Onde o e-mail deixou a escolha do dia
em aberto, a escolha está justificada no motivo e é trocável — a Mari manda.

Códigos de banco: M+ T+ D+ N+ = BHP (trabalha a mais, fica no banco; o Senior
não recebe) · M- T- D- N- = BHN (dispensa: não trabalha; o Senior recebe o
plantão normal) · Dm+ = dia em que só a manhã é BHP.
"""

EDITS = [
    # item 2 · Anna: 24h no fim de setembro (28 T, 29 M, 30 D) → a Sem 1 fecha em 36h
    (2, "Anna", 3, "N", "N+", "sáb 03/10 é BHP (a semana já tinha 24h de setembro)"),
    (2, "Anna", 14, "D", "D-", "BHN de 12h na Sem 3 pagando o BHP do dia 03 — 14/10 tinha folga de cobertura (M20/T14)"),
    # item 3 · Beatriz
    (3, "Beatriz", 5, "D", "Dm+", "05/10: a manhã é BHP (Sem 2 fecha em 30h contra 24)"),
    (3, "Beatriz", 14, "", "M-", "14/10 manhã: BHN 'lá embaixo' (Sem 3 fecha em 18h + 6h de dispensa)"),
    # item 5 · DebMatias: 18h no fim de setembro (28 D, 29 T) → tirar a tarde de 01/10
    (5, "DebMatias", 1, "T", "", "Sem 1 estava em 30h; a Kariny assume a tarde de 01/10 (item 8)"),
    # item 6 · DebAlves: duas semanas de 36h — só uma pode; a Sem 3 vira 42
    (6, "DebAlves", 15, "T", "D", "qui 15/10 vira D (+6h): tarde de completude na quinta é o padrão dela; a Sem 5 fica como a única de 36h"),
    # item 7 · Amelio: descrever BHP/BHN
    (7, "Amelio", 3, "D", "D+", "Sem 1 = 48h: o D de sábado 03 é BHP"),
    (7, "Amelio", 17, "D", "D+", "Sem 3 = 48h: o D de sábado 17 é BHP"),
    (7, "Amelio", 26, "", "M-", "fora 24–31/10: BHN de 24h pagando os dois BHP (seg)"),
    (7, "Amelio", 27, "", "M-", "fora 24–31/10: BHN (ter)"),
    (7, "Amelio", 28, "", "M-", "fora 24–31/10: BHN (qua)"),
    (7, "Amelio", 29, "", "M-", "fora 24–31/10: BHN (qui)"),
    # item 8 · Kariny: regra fixa — sáb+dom ⇒ BHN na segunda seguinte (ou no dia útil mais cheio) e BHP na quinta anterior
    (8, "Kariny", 1, "", "D+", "qui 01/10 manhã e tarde como BHP (cobre a tarde que a DebMatias larga)"),
    (8, "Kariny", 6, "D", "D-", "BHN em 06/10 (dia mais cheio da semana: M19/T11) em vez da segunda 05"),
    # item 9 · Fernando: troca sáb 17/10 → dom 04/10; sexta-noite 23/10 oferecida
    (9, "Fernando", 17, "", "M-", "sáb 17/10 manhã: BHN (a manhã foi trocada pro dom 04) — Sem 3 fecha em 24h"),
    (9, "Fernando", 25, "M", "M+", "dom 25/10 manhã é BHP — Sem 4 fecha em 36h contra 30"),
    # item 10 · Isabella: faltam 6h na Sem 1 → tarde de 02/10 (vaga da LuAlice, item 14)
    (10, "Isabella", 2, "", "T", "sex 02/10 tarde, como pedido ('ela entra na tarde que vaga'). ATENÇÃO: ela estava de férias até seg 28/09, e com o desconto do dia a Sem 1 já fechava em 30h — com esta tarde fica +6 (BHP). Se o desconto valer, tirar"),
    # item 11 · IsaRibeiro: cota de fds é piso — 18h de 24h
    (11, "IsaRibeiro", 7, "T", "", "sai da tarde de qua 07/10 (T12, sobrava) …"),
    (11, "IsaRibeiro", 11, "", "T", "… e entra na tarde de dom 11/10, que estava com buraco (T7/8) — fds fecha em 24h"),
    # item 13 · Laura: 30 / 18 / 18 → equalizar
    (13, "Laura", 4, "T", "T+", "Sem 1 = 30h: o dom 04 tarde é BHP (tirar abriria buraco na tarde de domingo)"),
    (13, "Laura", 8, "", "M-", "qui 08/10 manhã: BHN pagando o BHP do dia 04 — Sem 2 fecha em 18h + 6h"),
    (13, "Laura", 16, "", "M", "sex 16/10 manhã — Sem 3 sobe de 18h pra 24h (M14 → 15)"),
    # item 14 · LuAlice: 01 N + 02 D = 24h emendadas → o D vira dois períodos de CRO
    (14, "LuAlice", 2, "D", "CRO", "tarde de CRO em vez do D (a noite de 01 acaba às 7h; CRO começa às 13h)"),
    (14, "LuAlice", 9, "", "CRO", "2º período de CRO do mês — DIA A CONFIRMAR com ela"),
    # item 15 · Marcia: 36h na Sem 1 (28 D e 30 N em setembro)
    (15, "Marcia", 2, "N", "N+", "sexta-noite 02/10 é BHP"),
    (15, "Marcia", 14, "N", "N-", "qua 14/10 noite: BHN de 12h pagando (N9/7 no dia, sobrava)"),
    # item 16 · Neyde
    (16, "Neyde", 4, "N", "N+", "dom 04/10 noite é BHP (Sem 1 = 48h com as 3 noites de setembro)"),
    (16, "Neyde", 17, "", "N-", "sáb 17/10 noite: BHN lançado como dispensa, como pedido"),
    # item 17 · Melara
    (17, "Melara", 4, "T", "T+", "dom 04/10 tarde é BHP (Sem 1 = 30h)"),
    (17, "Melara", 27, "", "T-", "ter 27/10 tarde: BHN pagando (Sem 5 fecha em 18h + 6h)"),
    # item 18 · MSalomão: 40h = uma semana de 36h, as outras 42
    (18, "MSalomão", 1, "M", "D", "qui 01/10 vira D — a Sem 1 fecha em 42h (o e-mail dela dizia 42)"),
    (18, "MSalomão", 9, "M", "D", "sex 09/10 vira D — a Sem 2 fecha em 42h; a Sem 5 fica como a única de 36h"),
    # item 19 · Mayana: só 30h na Sem 1
    (19, "Mayana", 2, "", "M", "sex 02/10 manhã — fecha a Sem 1 em 36h e repõe a manhã que a LuAlice larga (item 14)"),
    # item 20 · MayWobido
    (20, "MayWobido", 10, "N", "N+", "sáb 10/10 noite é BHP (Sem 2 = 36h)"),
    (20, "MayWobido", 29, "", "T-", "qui 29/10 tarde: BHN pagando (Sem 5 fecha em 18h + 6h)"),
    # item 21 · Moabe
    (21, "Moabe", 3, "D", "D+", "sáb 03/10 é BHP (Sem 1 = 36h com 28 D e 30 N de setembro)"),
    (21, "Moabe", 8, "", "D-", "qui 08/10: BHN de 12h pagando (Sem 2 tinha só 12h)"),
    (21, "Moabe", 18, "N", "", "18 N + 19 D eram 24h emendadas: a noite sai do domingo …"),
    (21, "Moabe", 17, "", "N", "… e vai pro sábado 17, que estava com N5/7. ATENÇÃO: o dom 18 fica com N6/7 — precisa de alguém"),
    # item 22 · Thamyres: retorno de férias (alvo 18) e as semanas 'pagando'
    (22, "Thamyres", 10, "T", "T+", "Sem 2 = 24h contra 18 (retorno de férias): a tarde de sáb 10 é BHP"),
    (22, "Thamyres", 14, "", "D-", "Sem 3 = 12h: BHN de 12h na qua 14"),
    (22, "Thamyres", 25, "T", "T+", "Sem 4 = 30h: a tarde de dom 25 é BHP"),
    (22, "Thamyres", 28, "T", "T+", "Sem 5 = 30h: a tarde de qua 28 é BHP"),
    # item 23 · Vinicius: semana de retorno = 36h, precisa ser 30
    (23, "Vinicius", 27, "M", "M+", "ter 27/10 (dia do retorno): a manhã é BHP — não sai da rotina"),
    # item 24 · Raphael
    (24, "Raphael", 3, "N", "N+", "sáb 03/10 noite é BHP (Sem 1 = 36h com 28 N de setembro)"),
    (24, "Raphael", 7, "", "N-", "qua 07/10 noite: BHN de 12h pagando"),
]

# itens sem alteração de célula — o que foi verificado
SEM_ALTERACAO = [
    (1, "Aline", "CEP já está em toda semana que ela trabalha: 28/09 (seg), 06/10 (1ª terça, reunião) e "
                 "13/10. Férias a partir de 19/10. Nada a lançar — se a leitura for outra, dizer qual semana."),
    (4, "Raquel", "Os CP ESTÃO lançados: 20 e 21/10 (semana do retorno, 2 CP) e 26 e 28/10 (última semana, "
                  "2 CP). O código era 'P' e ninguém reconhecia — passou a se chamar CP na planilha."),
    (12, "JuBrito", "Sem 1 = 30h (29 D + 30 M de setembro + 01 D) = a CH dela, 30h (confirmada em agosto, "
                    "era 36). Se a CH voltou a 36, faltam 6h; senão está fechada."),
    (25, "Senior", "Aplicado na aba SENIOR e na tabela de códigos: célula BHP (+) não gera código; célula "
                   "BHN (−) gera o código do plantão normal."),
]

# regras que a checagem revelou e a planilha passou a medir
REGRAS = [
    ("Alvo por semana civil", "A carga contratada fecha semana a semana (seg–dom), contando os dias de "
     "setembro/novembro que fecham a semana. Coluna BH de cada semana = horas − alvo."),
    ("BHP/BHN grafados", "Semana acima do alvo: o plantão a mais é BHP (código com +, inline). Semana abaixo: "
     "BHN (código com −, dispensa). Pode fracionar 12h em 6+6. Sem a grafia não dá pra conferir."),
    ("40h = 42/42/36", "DebAlves e MSalomão: exatamente UMA semana de 36h no mês; as outras 42h."),
    ("Cota de fds é piso", "Quem tem 24h de cota faz 24h de fds — nem mais, nem menos (IsaRibeiro)."),
    ("Regra da Kariny", "Sáb + dom do mesmo fds ⇒ BHN na segunda seguinte (ou no dia útil mais cheio) e BHP "
     "na quinta anterior. Nunca 4 dias de 12h emendados."),
    ("Nunca 24h emendadas", "Noite + dia seguinte inteiro é proibido (LuAlice 01→02, Moabe 18→19 corrigidos)."),
    ("Semana de retorno de férias", "Cada dia de férias na semana desconta 6h do alvo (Thamyres 24→18, "
     "Vinicius 36→30)."),
    ("Senior", "BHP não é digitado. BHN aparece como plantão normal."),
]


def aplicar(por_pessoa, verbose=True):
    """aplica EDITS em {apelido: {dia: código}} (modifica no lugar) e devolve o log."""
    log = []
    for item, ap, dia, de, para, motivo in EDITS:
        atual = por_pessoa.get(ap, {}).get(dia, "")
        if atual != de:
            log.append((item, ap, dia, f"ESPERAVA '{de}', achou '{atual}' — aplicado mesmo assim"))
        if para:
            por_pessoa.setdefault(ap, {})[dia] = para
        else:
            por_pessoa.get(ap, {}).pop(dia, None)
    if verbose:
        for l in log:
            print("  ⚠", l)
    return log
