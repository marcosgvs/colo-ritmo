#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dados declarativos da planilha unificada v4 — regras como DADO, não como
fórmula enterrada em célula, pra que o /ritmo/equipe porte isto depois em vez
de re-deduzir. Fonte: docs/escala-hcb-referencia.md + atualizações de agosto/26.
"""

# ------------------------------------------------------------------ turnos
# letra: (rótulo, horário, horas, código Senior, conta em M?, conta em T?, conta em N?)
TURNOS = {
    "M":  ("manhã",         "07–13h",          6,  "2",   1, 0, 0),
    "T":  ("tarde",         "13–19h",          6,  "239", 0, 1, 0),
    "D":  ("dia 12h",       "07–19h",          12, "40",  1, 1, 0),
    "N":  ("noite 12h",     "19–07h",          12, "41",  0, 0, 1),
    "NT": ("noitinha",      "19–01h",          6,  "349", 0, 0, 1),
    "C":  ("10h chefia",    "8–12 + 13–19h",   10, "47",  1, 1, 0),
    "A":  ("administrativo","8h diurno",       8,  "11",  0, 0, 0),
    "J":  ("5h Janaina",    "08–13h",          5,  "78",  1, 0, 0),
    "E":  ("4h CEP",        "08–12h",          4,  "6",   1, 0, 0),
    "P":  ("paliativo",     "07–13h",          6,  "",    0, 0, 0),
    "R":  ("CRO",           "13–19h",          6,  "",    0, 0, 0),
    "FE": ("férias",        "—",               0,  "Férias", 0, 0, 0),
    "LM": ("licença",       "—",               0,  "LM",  0, 0, 0),
    "AB": ("abono niver",   "—",               0,  "",    0, 0, 0),
}
CODIGOS_ANTIGOS = {"110": "M (manhã)", "82": "D (dia 12h)", "83": "N (noite 12h)",
                   "10": "J (5h, virou 78)"}

# ------------------------------------------------- cobertura mínima (regra nova)
MINIMOS = {          # (manhã, tarde, noite)
    "útil":    (14, 10, 7),
    "sábado":  (10,  8, 7),
    "domingo": ( 9,  8, 7),
}
NOTA_MINIMOS = ("Regra da Mari de 13/08/26, vale da escala de outubro em diante. "
                "Substitui 11/8/7 e 9/7/6. A 10ª da manhã de sábado é sempre a "
                "Janaina (8–13h); ela nunca faz domingo. Feriado escala como o dia "
                "da semana em que cai.")

# ------------------------------------------------ cota de fds em mês com férias
COTA_FDS_FERIAS = [
    # CH semanal, 2 semanas de férias, 1 semana, sem férias
    (36, 24, 30, 36),
    (30, 18, 24, 30),
    (24, 12, 18, 24),
]

# ------------------------------------------------------------- regras duras
REGRAS_DURAS = [
    ("interjornada", "11h entre o fim de uma jornada e o início da seguinte",
     "art. 66 CLT", "ALERTA",
     "Descanso abaixo de 11h gera hora extra indenizável e autuação do MTE."),
    ("18h no mesmo dia", "dia inteiro (07–19h) + noite (19–07h) = 24h seguidas",
     "art. 66 CLT", "ALERTA", "Nunca lançar."),
    ("18h invertido", "noite 19–07h emendando manhã 07–13h — zero descanso",
     "art. 66 CLT", "ALERTA",
     "Era 15 casos/mês no 1º trimestre/26 e caiu pra ~2 depois da mudança de "
     "abril. O alvo é zero; o validador segura a linha."),
    ("noite + tarde seguinte", "noite 19–07h + tarde 13–19h = 18h com 6h de pausa",
     "art. 66 CLT", "REGISTRO",
     "Prática estabelecida do serviço (90 casos em 6 meses, 26 pessoas, sem "
     "queda no ano). Decisão de 17/08/26: continua, fica registrado sem alarme."),
    ("DSR", "24h consecutivas de folga por semana",
     "art. 67 CLT", "ALERTA",
     "Quem faz 6h de manhã todo dia tem folga de 18h (13h→07h) e nunca alcança "
     "as 24h — isso é ESTRUTURAL da rotina/chefia, sinalizado uma vez, não por dia."),
    ("adicional noturno", "horas entre 22h e 05h; hora noturna vale 52min30s",
     "art. 73 CLT", "CÁLCULO",
     "Sai por pessoa/mês pra folha. Noite 19–07h cai integralmente na janela."),
    ("aniversário", "6h de folga na semana, só pra quem marcou SIM na ficha",
     "interno", "PREFERÊNCIA", ""),
]

# ----------------------------------------------------------------- roster
# apelido, nome completo, CH, grupo, restrições duras, SN, FE, observação
ROSTER = [
    ("Fred", "Frederico Pires", 36, "chefia", "seg+ter 10h chefia; qua+qui manhã", "não", "não", "CH zerada nas contagens de plantão"),
    ("Milena", "Milena", 36, "chefia", "seg/ter/qua manhã; qui 10h chefia", "não", "não", ""),
    ("Pabdo", "Paula Abdo", 36, "chefia", "rotina/coordenação", "não", "não", "aniversário 29/10, sem folga"),
    ("MSalomão", "Marina Salomão", 40, "chefia", "manhãs seg–sex; PROIBIDO dom noite emendando (18h invertido) → sáb noite; NÃO sexta tarde", "não", "não", "bloqueio 42/42/36 · rodízio fds 15/15 com Vinicius, contínuo no ano · abre outubro com 42h"),
    ("DebAlves", "Deborah Alves", 40, "chefia", "manhãs seg–sex + tardes p/ completar (ter, senão qui)", "não", "não", "bloqueio 42/42/36 · cota fds 24h"),
    ("Vinicius", "Vinicius Bezerra", 36, "chefia", "manhãs seg–sex + fds 15/15 com MSalomão", "não", "sim", "bloqueio 30/42 · FÉRIAS 12–26/10"),
    ("Amelio", "Fernanda Amelio", 36, "chefia", "SEM NOTURNOS (atestado desde abr/25); seg–sex manhãs", "não", "não", "fora 24–31/10 (BHN)"),
    ("Murilo", "Murilo", 36, "rotina", "rotina onco manhãs; fds 15/15 sábado noturno", "não", "não", "voltou de licença"),
    ("Janaina", "Janaina Rabelo", 30, "30h", "SÓ 8–13h (código 78); sem noturnos; seg–sáb", "não", "não", "é sempre a 10ª da manhã de sábado; NUNCA domingo"),
    ("Aline", "Aline Saliba", 40, "36h", "CEP 4h: 1ª terça manhã do mês; demais semanas seg ou qui", "não", "sim", "36 assist + 4 CEP · FÉRIAS 19/10–02/11"),
    ("CaAbreu", "Camila Abreu", 36, "36h", "fixa qua dia (+seg dia); NÃO qui noite", "não", "sim", ""),
    ("Danielle", "Danielle Tanajura", 36, "36h", "fixa qua noite (+qui noite); só noites", "não", "não", "não lançar sexta-noite (já fez muitas)"),
    ("Fabiula", "Fabiula Czameski", 36, "36h", "só noites; ter/qua/qui alternando com ter/qua/dom", "sim", "não", ""),
    ("Isabella", "Isabella Mazzaro", 36, "36h", "fixo sex dia; NÃO qua noite, NÃO qui noite; evitar sáb noite", "sim", "não", "INVERTEU em out: não pode mais sextas"),
    ("JuBrito", "Julliana Brito", 30, "30h", "fixa ter dia, qua manhã, qui dia, sex manhã; NÃO segundas (Sobradinho)", "não", "não", "CH 30h CONFIRMADO (era 36) · +6h fds a cada 2 meses · não quer o feriado 12/10"),
    ("Kariny", "Fernanda Kariny", 36, "36h", "fixa seg/ter/qui dia; NÃO quartas; 6h avulsa só de manhã", "não", "não", "repouso 09–12/10 (procedimento)"),
    ("Mayana", "Mayana Leal", 36, "36h", "fixa ter dia, qui dia; NÃO seg/qua/sex tarde", "não", "não", ""),
    ("Neyde", "Neyde Brito", 36, "36h", "fixa ter+qua noite + 1º/3º/4º dom noite; NÃO qui/sex/sáb noite (HMIB)", "não", "sim", "férias 19/10 + 15 dias"),
    ("Roberta", "Roberta Iglesias", 36, "36h", "coringa", "não", "sim", ""),
    ("LuAlice", "Luciana Alice", 36, "36h", "fixa ter+qui noite, sáb noite no fds; SÓ noturnos (+tardes CRO)", "sim", "não", "NUNCA lançar banco de horas · 36h temporária, 12h/mês CRO · não lançar sextas 02 e 30/10 N"),
    ("Amanda", "Amanda Braga", 30, "30h", "alterna qui noite / qua dia", "sim", "sim", "férias até ~12/10 · NÃO escalar fds extra em outubro (fez horas a mais em set)"),
    ("Fernando", "Fernando Filardi", 30, "30h", "fixo seg noite, qua+qui manhã, sáb manhã", "não", "não", "troca sáb 17/10 → dom 04/10 manhã; oferece sexta-noite 23/10"),
    ("João", "João", 30, "30h", "NÃO manhãs, NÃO segundas, NÃO sábados; ter/qui/sex tarde + qua noite", "não", "não", "extrapola fds · férias até ~06/10"),
    ("JuCoutinho", "Juliana Coutinho", 30, "30h", "fixa qua diurno, sextas manhãs; NÃO qui dia", "não", "não", "prefere 6h em vez de 12h"),
    ("LeLemos", "Leticia Lemos", 30, "30h", "seg dia ↔ seg noite alternando", "1/mês", "sim", "férias até 05/10"),
    ("Leomara", "Leomara", 24, "24h", "só seg/ter manhã, qua noite, sex dia/noite, fds; evitar 2 noturnos/semana", "não", "não", "24h desde ago"),
    ("Marilia", "Marilia", 30, "30h", "ter dia ↔ qua dia 15/15; sexta só manhã; NÃO segundas (Luzia)", "não", "não", "pediu a sexta-noite dela em out (16/10) em vez de nov"),
    ("Raylander", "Daniel Raylander", 30, "30h", "NÃO seg tarde, qui manhã, sex dia (faculdade); aceita noturnos seguidos", "não", "SIM obrigatório", "casado com Ariadne — nunca no mesmo turno"),
    ("Ricardo", "Ricardo", 30, "30h", "fixo ter noite (sai da fixa quando faz SN/fds)", "não", "sim", "escalar junto com Nishioka"),
    ("Rosana", "Rosana", 30, "30h", "só manhãs e noites/noitinhas (mãe em quimio): SEM tardes, SEM 12h diurnas", "não", "não", "férias até ~12/10"),
    ("AnaSeverino", "Ana Severino", 24, "24h", "seg (M/dia/N) ou qui noite; NÃO tardes", "não", "sim", ""),
    ("Anna", "Anna Jorge", 24, "24h", "NÃO seg manhã/noite, ter tarde, qui inteiro, sex tarde, dom noite", "não", "não", "habitual seg/qua tarde"),
    ("Ariadne", "Ariadne", 24, "24h", "casada com Raylander — NUNCA no mesmo turno", "não", "não", "volta de licença 26/10, CH passa a 24h"),
    ("Beatriz", "Beatriz", 24, "24h", "mora parte em SP; manda blocos de indisponibilidade", "sim", "não", ""),
    ("Bruna", "Bruna", 24, "24h", "habitual terças (dia ou noite)", "não", "não", "férias a partir de 19/10"),
    ("Constantino", "Fernanda Constantino", 24, "24h", "seg noite OU ter noite, qui noite; NÃO quartas; evitar noites consecutivas", "não", "sim", "trabalhou 07/09 → folgar 12/10; não escalar fds 10–11"),
    ("DebMatias", "Debora Matias", 24, "24h", "ter/qua/sex dia (não toda sexta); noturno só ter noite", "não", "não", ""),
    ("Denise", "Denise", 24, "24h", "fixa seg/ter/qui manhã; NÃO tardes; evitar 2 noturnos/semana", "não", "não", ""),
    ("Ernesto", "Carlos Ernesto", 24, "24h", "qua diurno, sex noite 15/15, dom noite 15/15; seg/ter/qui NÃO", "sim estrutural", "não", "e-mail novo: dr.carlos.ernesto.pediatra@gmail.com"),
    ("Grayce", "Grayce Maya", 24, "24h", "ter noite + qui dia; NÃO quartas; não lançar 6h avulsas (preferir 12h)", "não", "não", "aniversário 19/10, sem pedido de abono"),
    ("Heloa", "Heloa", 24, "24h", "manhãs/tardes, quase sem noturno", "não", "não", "voltou de licença 29/07"),
    ("Iggor", "Iggor Almeida", 24, "24h", "fixo qua dia; NÃO qui tarde/noite", "não", "não", "reivindica a sexta-noite 23/10"),
    ("IsaRibeiro", "Isabela Ribeiro", 24, "24h", "coringa", "não", "não", ""),
    ("Jaqueline", "Jaqueline", 24, "24h", "", "não", "não", "voltou de licença · CH 24h"),
    ("Joaquim", "Joaquim", 24, "24h", "fixo seg noturno + qui/sáb noite; SÓ noturnos; NÃO ter/qua/dom noite", "2/mês voluntário", "não", "cota fds 24h · sem sexta-noite este mês (excepcional)"),
    ("JuliaFig", "Julia Figueiredo", 24, "24h", "seg/ter manhã OU noite (pref. noite); NÃO tarde, qua noite, qui, sex; sem 18h invertido", "sim", "não", ""),
    ("Kozak", "Ana Kozak", 24, "24h", "fixa TODAS qui noite + sáb noite; NÃO manhãs úteis, NÃO sáb/dom dia (ICDF)", "só quando o marido não está de plantão", "não", "extrapola fds p/ fechar CH · FÉRIAS 05–19/10 · folga sáb 31/10 (niver da filha)"),
    ("Laura", "Laura Haydee", 24, "24h", "praticamente só manhãs (inclusive fds); sem 12h, sem noturno", "não", "SIM obrigatório", "sem preferências enviadas em out — provisório"),
    ("Leticia", "Letícia Café", 24, "24h", "fixa ter+qui dia; NÃO seg/qua/sex tarde; sem noturnos", "não", "não", "férias até ~06/10"),
    ("LuCosta", "Luciana Costa", 24, "24h", "NÃO diurnos em dia útil; noites de semana + fds dia; sem 2 noites seguidas", "não", "não", ""),
    ("Marcia", "Marcia", 24, "24h", "sexta-noite fixa na 1ª semana; qua noite nas demais; completa com seg dia", "1ª semana", "não", ""),
    ("MayWobido", "Mayara Wobido", 24, "24h", "tardes e noites; NÃO seg noite, qua manhã; quer fixar qua noite", "sim", "obrigatório +6 fixo", "cota fds 30h · aniversário 31/10, quer o abono"),
    ("Melara", "Luciana Melara", 24, "24h", "fixa TODOS os domingos (dia ou noite); NÃO 12h seguidas em dia útil", "≥2/mês por preferência", "não", "semana: 2 tardes ou noitinha"),
    ("Moabe", "Moabe", 24, "24h", "fixa seg dia; NÃO ter dia (ICDF — conferir se é ter ou qua); NÃO 1º fds do mês (pós)", "não", "não", "sem preferências enviadas em out — provisório"),
    ("Nishioka", "Laura Nishioka", 24, "24h", "fixo ter noite (sai quando faz SN/fds)", "não", "não", "escalar junto com Ricardo"),
    ("Patricia", "Patricia Abreu", 24, "24h", "diurnos, habitual qui dia", "sim", "não", ""),
    ("Pedro", "Pedro", 24, "24h", "fixo seg noite, qua tarde, sex tarde; NÃO manhãs", "rodízio", "não", ""),
    ("Pjamile", "Paula Jamile", 24, "24h", "fixa qua dia + sex dia; NÃO seg, ter tarde, qui tarde", "não", "não", ""),
    ("Raphael", "Raphael Costa", 24, "24h", "NÃO manhãs seg–sex", "sim", "não", ""),
    ("Raquel", "Raquel Assis", 24, "24h", "CP seg+qua manhã; NÃO tardes, NÃO quintas; máx 1 noturno/semana", "1", "não", "12h CP + 12h plantão + 24h fds · férias 05–19/10"),
    ("Thamyres", "Thamyres", 24, "24h", "MÁX 1 NOTURNO/MÊS (relatório médico); NÃO seg/ter, qui dia, dom noite", "não", "não", "fds em 12h emendadas"),
    ("Vanessa", "Vanessa", 24, "24h", "fixa qua dia; máx 1 noturno/semana", "não", "não", ""),
    ("Yuji", "Henrique Yuji", 24, "24h", "NÃO seg e sex (dia+noite); ter/qua/qui ok; fds coringa de DOMINGOS (não pode sábados)", "não", "não", "licença-paternidade: DPP 09/10, 20 dias"),
    ("JuIsaac", "Julia Isaac", 40, "administrativo", "código 11 diário", "não", "não", "não pega plantão"),
    ("Stephanie", "Stephanie", 40, "administrativo", "código 11", "não", "não", "não pega plantão"),
    ("MPinheiro", "Mariana Pinheiro", 40, "administrativo", "", "não", "não", "não pega plantão desde ago"),
]

FORA_DO_ROSTER = [
    ("Dayana", "saiu do hospital (decisão registrada em 17/08/26)"),
    ("Kairala", "Andréa Kairala — aparece só de fev a abr/26 no histórico"),
]

# --------------------------------------------------------------- procedência
PROCEDENCIA = {
    1:  ("grade", "reconstruído da grade 'ESCALA FINAL JANEIRO 2026' — a grade começa no dia 2"),
    2:  ("senior", "códigos Senior (códigos antigos 110/82/83)"),
    3:  ("senior", "códigos Senior (códigos antigos 110/82/83)"),
    4:  ("senior", "códigos Senior — mudança de abril: passa a 2/40/41"),
    5:  ("grade", "reconstruído da grade; dias 1–2 vêm do arquivo de abril; DIA 3 NÃO EXISTE em nenhum arquivo"),
    6:  ("grade", "reconstruído da grade 'Escala junho - UTI HCB'"),
    7:  ("senior", "códigos Senior"),
    8:  ("senior", "códigos Senior"),
    9:  ("senior", "códigos Senior"),
    10: ("montado", "escala montada pelo escala_out_v3.py — cobertura 100%, 48 convocações por critério público"),
    11: ("vazio", "a montar"),
    12: ("vazio", "a montar"),
}
AVISO_GRADE = ("Meses reconstruídos da grade têm FIDELIDADE MENOR: a grade lista nomes por "
               "turno, não códigos. 10h de chefia (47), 4h de CEP (6) e 5h da Janaina (78) "
               "aparecem só como nome na coluna da manhã e entram como manhã de 6h — a carga "
               "horária desses meses fica subestimada pra chefia. Manhã+tarde no mesmo dia "
               "foi lido como 12h dia. Anotações BHN (dispensa) foram excluídas; BHP conta.")

# feriado: (nome, sigla curta que cabe na coluna do dia)
FERIADOS_2026 = {
    (1, 1):   ("Confraternização", "1ºjan"),
    (2, 16):  ("Carnaval", "carn"),
    (2, 17):  ("Carnaval", "carn"),
    (4, 3):   ("Paixão", "paix"),
    (4, 21):  ("Tiradentes", "tira"),
    (5, 1):   ("Dia do Trabalhador", "trab"),
    (6, 4):   ("Corpus Christi", "corp"),
    (9, 7):   ("Independência", "indep"),
    (10, 12): ("N. Sra. Aparecida", "N.Sra"),
    (11, 2):  ("Finados", "finad"),
    (11, 15): ("Proclamação da República", "repúb"),
    (11, 20): ("Consciência Negra", "consc"),
    (12, 25): ("Natal", "natal"),
}
NOTA_FERIADOS = ("Feriado escala como o DIA DA SEMANA em que cai — não reduz a lotação "
                 "exigida (doc de referência §2). Confirmado na prática: nos sete feriados "
                 "de 2026 até setembro a manhã rodou com 15 a 20 pessoas, e a rotina/chefia "
                 "trabalhou em todos eles (4 a 6 pessoas). O que muda no feriado é a "
                 "contabilidade, que tem coluna própria e equalização anual.")
