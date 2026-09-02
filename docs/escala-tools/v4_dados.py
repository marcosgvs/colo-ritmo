#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dados declarativos da planilha unificada v4 — regras como DADO, não como
fórmula enterrada em célula, pra que o /ritmo/equipe porte isto depois em vez
de re-deduzir. Fonte: docs/escala-hcb-referencia.md + atualizações de agosto/26.
"""

# ------------------------------------------------------------------ turnos
# letra: (rótulo, horário, horas, código Senior, conta em M?, conta em T?, conta em N?)
TURNOS = {
    "M":   ("manhã",          "07–13h",          6,  "2",   1, 0, 0),
    "T":   ("tarde",          "13–19h",          6,  "239", 0, 1, 0),
    "D":   ("dia 12h",        "07–19h",          12, "40",  1, 1, 0),
    "N":   ("noite 12h",      "19–07h",          12, "41",  0, 0, 1),
    "NT":  ("noitinha",       "19–01h",          6,  "349", 0, 0, 1),
    "C":   ("10h chefia",     "8–12 + 13–19h",   10, "47",  1, 1, 0),
    "A":   ("administrativo", "8h diurno",       8,  "11",  0, 0, 0),
    "J":   ("5h Janaina",     "08–13h",          5,  "78",  1, 0, 0),
    "CEP": ("4h CEP",         "08–12h",          4,  "6",   1, 0, 0),
    "CP":  ("CP · cuidados paliativos", "07–13h", 6, "",    0, 0, 0),
    "CRO": ("CRO · ambulatório", "13–19h",       6,  "",    0, 0, 0),
    # banco de horas — "+" = BHP (trabalhou a MAIS: fica no banco; o Senior NÃO
    # recebe esse plantão) · "-" = BHN (dispensa paga pelo banco: não trabalha,
    # mas o Senior recebe o plantão normal, como se trabalhado — regra da casa,
    # confirmada por Marcos/Mari em 28/08/26, item 25 da checagem)
    "M+":  ("manhã BHP",      "07–13h · banco",  6,  "",    1, 0, 0),
    "T+":  ("tarde BHP",      "13–19h · banco",  6,  "",    0, 1, 0),
    "D+":  ("dia BHP",        "07–19h · banco",  12, "",    1, 1, 0),
    "N+":  ("noite BHP",      "19–07h · banco",  12, "",    0, 0, 1),
    "Dm+": ("dia · manhã é BHP", "07–19h",       12, "239", 1, 1, 0),
    "Dt+": ("dia · tarde é BHP", "07–19h",       12, "2",   1, 1, 0),
    "M-":  ("BHN da manhã",   "dispensa",        0,  "2",   0, 0, 0),
    "T-":  ("BHN da tarde",   "dispensa",        0,  "239", 0, 0, 0),
    "D-":  ("BHN do dia",     "dispensa",        0,  "40",  0, 0, 0),
    "N-":  ("BHN da noite",   "dispensa",        0,  "41",  0, 0, 0),
    "Tm-": ("tarde · manhã é BHN", "13–19h",     6,  "40",  0, 1, 0),
    "Mt-": ("manhã · tarde é BHN", "07–13h",     6,  "40",  1, 0, 0),
    "FE":  ("férias",         "—",               0,  "Férias", 0, 0, 0),
    "LM":  ("licença",        "—",               0,  "LM",  0, 0, 0),
    "AB":  ("abono niver",    "—",               0,  "",    0, 0, 0),
}
BHP = {"M+", "T+", "D+", "N+", "Dm+", "Dt+"}
BHN = {"M-", "T-", "D-", "N-", "Tm-", "Mt-"}
AUSENCIAS = {"FE", "LM", "AB"}


def efetivo(letra):
    """o turno de fato TRABALHADO por trás do código (descanso, cobertura,
    validador). None = não trabalha nesse dia (BHN puro, férias, licença)."""
    if letra in ("M-", "T-", "D-", "N-") or letra in AUSENCIAS:
        return None
    if letra == "Tm-":
        return "T"
    if letra == "Mt-":
        return "M"
    if letra in ("Dm+", "Dt+"):
        return "D"
    if letra.endswith("+"):
        return letra[:-1]
    return letra


def base_visual(letra):
    """a letra cuja cor a célula herda (M+ pinta como M, Tm- como T…)."""
    if letra in ("Dm+", "Dt+"):
        return "D"
    if letra in ("Tm-",):
        return "T"
    if letra in ("Mt-",):
        return "M"
    return letra.rstrip("+-")


# ------------------------------------------------ alvo semanal (o BH da semana)
# A carga contratada é alvo POR SEMANA CIVIL (seg–dom) — regra revelada pelos 25
# itens da checagem de Marcos/Mari (28/08/26). BH da semana = horas − alvo:
# positivo = BHP (a mais, fica no banco) · negativo = BHN (faltou / dispensa).
# 40h (DebAlves, MSalomão): o alvo é 42 — exatamente UMA semana do mês fica em
# 36 (o antigo 42/42/36), e é essa que aparece com −6. Aline: 36 assist + 4 CEP.
ALVO_SEMANAL = {"DebAlves": 42, "MSalomão": 42, "Aline": 40}
# cada dia de férias/licença/abono na semana desconta isto do alvo (Thamyres
# voltou de férias na terça: alvo 24 → 18 · Vinicius idem: 36 → 30 — item 22/23)
DESCONTO_AUSENCIA_SEMANA = 6
NOTA_ALVO = ("Alvo semanal = carga contratada por semana civil (segunda a domingo), contando "
             "os dias do mês vizinho que fecham a semana. 40h → alvo 42 com UMA semana de 36 "
             "no mês (a que aparece com −6). Cada dia de férias/licença/abono na semana "
             "desconta 6h do alvo. O BH da semana é horas − alvo: positivo é BHP (fica no "
             "banco), negativo é BHN (faltou ou foi dispensa). Marque o BHP/BHN na própria "
             "célula com os códigos + e − para a conferência bater.")
CODIGOS_ANTIGOS = {"110": "M (manhã)", "82": "D (dia 12h)", "83": "N (noite 12h)",
                   "10": "J (5h, virou 78)"}

# ------------------------------------------------- cobertura mínima (regra nova)
MINIMOS = {          # (manhã, tarde, noite)
    "útil":    (14, 10, 7),
    "sábado":  (10,  8, 7),
    "domingo": ( 9,  8, 7),
}
# regra em vigor até setembro/26 — medir jan–set pela regra nova seria cobrar do
# passado algo que não existia (doc de referência §2)
MINIMOS_ANTIGOS = {
    "útil":    (11, 8, 7),
    "sábado":  ( 9, 7, 6),
    "domingo": ( 9, 7, 6),
}
VIGENCIA_NOVA = 10          # de outubro/26 em diante vale a regra nova

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
# ------------------------------------------------------------- tooltips
# Texto de cada sigla/coluna abreviada. O gerador cola isto como comentário da
# célula (vira "nota" no Google Sheets, aparece no hover) — pra ninguém precisar
# decorar e pra planilha não virar um mar de texto explicativo visível.
TOOLTIPS = {
    "médico":   "Apelido usado na escala. O nome completo está no CADASTRO e na aba SENIOR.",
    "CH":       "Carga horária semanal contratada, em horas.",
    "CH mês":   "Horas trabalhadas no mês — soma de todos os turnos lançados na linha. "
                "Recalcula sozinho ao digitar ou trocar um código.",
    "fds":      "Horas trabalhadas em sábados e domingos no mês.",
    "SxN":      "Sextas-noite no mês (a noite que COMEÇA na sexta às 19h). Alimenta o "
                "rodízio anual: quem fez entra na lista \u201cjá fez, não lançar\u201d.",
    "feriado":  "Horas trabalhadas em feriado no mês. A equalização é ANUAL: no próximo "
                "feriado, a prioridade de folga é de quem tem menor CH total e já fez todos.",
    "meta":     "Quanto a pessoa deveria trabalhar no mês: CH semanal × semanas do mês, "
                "arredondado.",
    "saldo":    "CH mês menos meta. Positivo = horas a mais · negativo = devendo (vira "
                "banco e compensa no mês seguinte).",
    "18h⚠":     "Vezes em que a noite (19–7h) emendou com a manhã seguinte com 2h ou "
                "menos de descanso — jornada de 18h. PROIBIDO: o art. 66 da CLT exige 11h "
                "entre jornadas. O alvo é zero; era ~15/mês até abril e caiu pra ~2.",
    "N→T":      "Noite (19–7h) seguida da tarde do dia seguinte (13–19h): 18h de trabalho "
                "com 6h de pausa. Prática aceita do serviço (decisão de 17/08/26) — fica "
                "registrada, sem alarme.",
    "cota fds": "Horas de fim de semana que cabem à pessoa no mês: 36h→36 · 30h→30 · "
                "24h→24, reduzida se houver férias (tabela no CONFIG). 40h é caso a caso "
                "— fica em branco.",
    "fds⚠":     "Excesso sobre a cota × fator do mês. Em mês de 5 fins de semana a soma "
                "das cotas do grupo não cobre a demanda — o alvo justo passa a ser a cota "
                "× o fator (CONFIG). Vermelho = carregando mais que a fatia proporcional.",
    "sem⚠":     "Maior jornada semanal da pessoa no mês — o MAX das colunas Sem 1 a "
                "Sem 6. Vermelho acima de 44h — teto do art. 7º XIII da Constituição. "
                "O mês pode fechar na média e uma semana estourar mesmo assim.",
    "bh-n":     "BH da semana = horas da semana − alvo semanal da pessoa (CADASTRO, coluna "
                "Alvo/sem; −6h por dia de férias/licença/abono na semana). Positivo = BHP, "
                "trabalhou a mais e fica no banco · negativo = BHN, faltou ou foi dispensa. "
                "Zero = semana fechada. Marque na célula: M+ T+ D+ N+ (BHP) · M- T- D- N- (BHN).",
    "alvo-sem": "Horas que a pessoa deve fechar por semana civil. Em geral é a CH; 40h → 42 "
                "(uma semana de 36 por mês); Aline 40 (36 + 4 de CEP). É contra este número que "
                "o BH de cada semana é medido.",
    "sem-n":    "Horas da semana civil (segunda a domingo). A Sem 1 inclui os dias do "
                "fim do mês anterior que fecham a semana; a última para no fim do mês — "
                "o resto dela é medido na Sem 1 do mês seguinte, então nenhuma semana "
                "fica sem dono. Vermelho acima de 44h.",
    "dia-seguinte": "A semana fecha no domingo: estas colunas mostram os dias do "
                "mês seguinte até o domingo que completa a última semana. Vêm POR "
                "FÓRMULA da aba do mês seguinte — para editar, use a aba de lá. "
                "Entram nas somas semanais (última Sem e Sem⚠), mas CH, FDS e "
                "saldo contam no mês seguinte (doc §6).",
    "dia-anterior": "Fim do mês anterior — as colunas fecham a 1ª semana civil do mês "
                "(dia 1º cai terça, a segunda aparece). Vêm POR FÓRMULA da aba do mês "
                "anterior: trocou lá, atualiza aqui. Entram nas somas semanais (Sem 1 "
                "e Sem⚠), mas CH, FDS e saldo delas pertencem ao mês anterior.",
    "cob-turno": "Quantas pessoas cobrem o turno em cada dia. D (dia 12h) e C (chefia) "
                "contam na manhã E na tarde; J (Janaina 8–13h) conta na manhã.",
    "falta":    "Quanto falta para o mínimo do dia (CONFIG — cada mês é medido pela regra "
                "que valia na época; feriado exige o mínimo do dia da semana em que cai). "
                "Vermelho = buraco de cobertura.",
    "grupo":    "Chefia e rotina fazem manhãs seg–sex e a CH deles não entra nas "
                "contagens de plantão · administrativo não pega plantão.",
    "grupo-filtro": "Ordene por esta coluna no funil do filtro para ver "
                "coordenação → rotina → staff → administrativo (o prefixo "
                "numérico é só para ordenar nessa sequência). Pode ordenar à "
                "vontade: toda fórmula da planilha acha cada pessoa pelo NOME, "
                "em qualquer ordem.",
    "ordem-original": "Posição original do cadastro. Depois de ordenar por "
                "Médico ou por Grupo, ordene por esta coluna (menor→maior no "
                "funil) para voltar à ordem padrão da planilha.",
    "sexta-noite ficha": "Posição da pessoa no rodízio de sexta-noite: sim/não, "
                "quantas por mês, ou condição especial (ex.: só quando o marido não "
                "está de plantão).",
    "fds extra ficha": "Pool do fds extra obrigatório, mês sim/mês não. \u201cSIM "
                "obrigatório\u201d = entra sempre que for o mês dela.",
    "conta-flags": "1 = lançar este código cobre a lotação daquele turno. É daqui que "
                "as contagens das abas mensais derivam — mudou aqui, muda o rodapé de "
                "todos os meses.",
    "fator":    "Demanda de fds do mês ÷ soma das cotas do grupo. Acima de 1 = o mês "
                "pede mais fim de semana do que as cotas somadas oferecem (outubro/26: "
                "5 sábados → 1,141). O alvo justo de cada um = cota × este fator.",
    "saldo-bloco": "CH do mês menos a meta, mês a mês. Positivo fez a mais, negativo "
                "ficou devendo. A coluna ANO acumula.",
    "fds-bloco": "Horas de fim de semana por mês, com o acumulado do ano.",
    "sxn-bloco": "Sextas-noite por mês (noite que começa na sexta) — o insumo do rodízio.",
    "feriado-bloco": "Horas de feriado por mês. A equalização anual usa o total: quem "
                "menos fez, trabalha o próximo.",
    "sxn-oficial": "O que a contagem MANUAL da escalista registrou em 2026 (planilha "
                "antiga). Serve de conferência histórica.",
    "sxn-calc": "O que ESTA planilha calcula a partir das grades. ",
    "difere":   "⚠ quando a contagem manual e a calculada divergem. Os erros de contagem "
                "à mão eram assumidos e compensados no mês seguinte — é normal haver ⚠.",
    "alertas 18h dash": "Casos de noite emendando manhã (≤2h de descanso) no mês inteiro. "
                "Art. 66 CLT — o alvo é zero.",
    "buracos dash": "Soma de tudo que faltou para o mínimo, nos três turnos, no mês "
                "inteiro (pessoas × turno × dia). Zero = escala completa.",
    "dias completos dash": "Dias em que os TRÊS turnos bateram o mínimo.",
    "lotação dash": "Média de pessoas por turno nos dias do mês.",
    "noturnas dash": "Horas dentro da janela 22h–05h — insumo do adicional noturno "
                "(art. 73 CLT: hora noturna vale 52min30s, adicional mínimo de 20%).",
    "cobertura-cal": "M/T/N = quantas pessoas em cada turno do dia · ✓ = os três mínimos "
                "batidos · ⚠ = falta gente.",
    "ausencias-cal": "Férias (FE), licenças (LM) e abonos (AB) do dia.",
}

# ---------------------------------------------------- a ordem de montar (dica)
DICA_ORDEM = [
    ("1º · Fins de semana",
     "Começa sempre pelos fds: preenche e deixa o mais justo possível. É o turno "
     "mais disputado e o que mais gera dívida — resolver por último significa "
     "despejar o resto em quem sobrou."),
    ("2º · Feriado",
     "Depois o feriado, que escala como o dia da semana em que cai e não reduz a "
     "lotação exigida."),
    ("3º · Resto da semana",
     "Por último os dias úteis, que têm o maior pool de gente elegível e por isso "
     "são os mais fáceis de fechar."),
]
NOTA_DICA = ("Dica do Marcos, 17/08/26. Vale como algoritmo, não só como conselho: o "
             "remontar_fds.py executa nesta ordem. E cuidado com mês de 5 sábados — a "
             "demanda de fds passa da soma das cotas do grupo e o excesso tem que ser "
             "dividido em proporção, porque zerar é aritmeticamente impossível.")

REGRAS_DURAS = [
    ("rotina só manhã", "Fred, Milena, Pabdo, MSalomão, DebAlves, Vinicius, Amelio e "
     "Murilo: dias úteis apenas pela manhã, e nunca aos fins de semana",
     "decisão Marcos 18/08/26", "ALERTA",
     "Revoga o rodízio 15/15 MSalomão↔Vinicius, o sábado noturno 15/15 do Murilo, "
     "o bloqueio 42/42/36 e as tardes de completude da DebAlves. O feriado segue a "
     "política própria (contagem anual). Janaina NÃO é rotina: seg–sáb 8–13h dela "
     "continua, e a 10ª manhã de sábado é dela por regra de cobertura."),
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
    ("Fred", "Frederico Pires", 36, "chefia", "coordenação: seg+ter 10h de chefia (47), qua+qui manhã", "não", "não", "o 47 é lançado pela coordenação · CH não entra nas contagens de plantão"),
    ("Milena", "Milena", 36, "chefia", "coordenação: seg/ter/qua manhã, qui 10h de chefia (47)", "não", "não", "o 47 é lançado pela coordenação"),
    ("Pabdo", "Paula Abdo", 36, "chefia", "manhãs seg–sex", "não", "não", "aniversário 29/10, sem folga"),
    ("MSalomão", "Marina Salomão", 40, "chefia", "manhãs seg–sex · D às quintas · N de domingo no rodízio de fds 15/15 com Vinicius · alvo 42h/semana com UMA semana de 36h no mês", "não", "não", "folga 12/10 (pedido individual) · NÃO sexta tarde"),
    ("DebAlves", "Deborah Alves", 40, "chefia", "manhãs e tardes seg–sex, D pra completar (cobre o gargalo das tardes) · alvo 42h/semana com UMA semana de 36h no mês", "não", "não", ""),
    ("Vinicius", "Vinicius Bezerra", 36, "chefia", "manhãs seg–sex · N de sábado no rodízio 15/15 com Murilo · fds 15/15 com MSalomão", "não", "sim", "FÉRIAS 12–26/10 — volta ter 27/10 (semana de retorno: alvo 30h)"),
    ("Amelio", "Fernanda Amelio", 36, "chefia", "manhãs seg–sex e D diurnos (inclusive fds) · SEM NOTURNOS (atestado)", "não", "não", "fora 24–31/10 (BHN) — compensa com BHP em 03 e 17/10"),
    ("Murilo", "Murilo", 36, "rotina", "rotina onco: manhãs seg–sex · N de sábado no rodízio 15/15 com Vinicius", "não", "não", ""),
    ("Janaina", "Janaina Rabelo", 30, "30h", "SÓ 8–13h (código 78); sem noturnos; seg–sáb", "não", "não", "é sempre a 10ª da manhã de sábado; NUNCA domingo"),
    ("Aline", "Aline Saliba", 40, "36h", "CEP 4h toda semana: 1ª terça manhã do mês (reunião); demais semanas seg ou qui", "não", "sim", "36 assist + 4 CEP (alvo semanal 40) · FÉRIAS 19/10–02/11"),
    ("CaAbreu", "Camila Abreu", 36, "36h", "fixa qua dia (+seg dia); NÃO qui noite", "não", "sim", ""),
    ("Danielle", "Danielle Tanajura", 36, "36h", "fixa qua noite (+qui noite); só noites", "não", "não", "não lançar sexta-noite (já fez muitas)"),
    ("Fabiula", "Fabiula Czameski", 36, "36h", "só noites; ter/qua/qui alternando com ter/qua/dom", "sim", "não", ""),
    ("Isabella", "Isabella Mazzaro", 36, "36h", "fixo sex dia; NÃO qua noite, NÃO qui noite; evitar sáb noite", "sim", "não", "INVERTEU em out: não pode mais sextas"),
    ("JuBrito", "Julliana Brito", 30, "30h", "fixa ter dia, qua manhã, qui dia, sex manhã; NÃO segundas (Sobradinho)", "não", "não", "CH 30h CONFIRMADO (era 36) · +6h fds a cada 2 meses · não quer o feriado 12/10"),
    ("Kariny", "Fernanda Kariny", 36, "36h", "fixa seg/ter/qui dia; NÃO quartas; 6h avulsa só de manhã", "não", "não", "repouso 09–12/10 (procedimento)"),
    ("Mayana", "Mayana Leal", 36, "36h", "fixa ter dia, qui dia; NÃO seg/qua/sex tarde", "não", "não", ""),
    ("Neyde", "Neyde Brito", 36, "36h", "fixa ter+qua noite + 1º/3º/4º dom noite; NÃO qui/sex/sáb noite (HMIB)", "não", "sim", "férias 19/10 + 15 dias"),
    ("Roberta", "Roberta Iglesias", 36, "36h", "coringa", "não", "sim", ""),
    ("LuAlice", "Luciana Alice", 36, "36h", "fixa ter+qui noite, sáb noite no fds; SÓ noturnos (+tardes CRO, código CRO)", "sim", "não", "NUNCA lançar banco de horas · 36h temporária, 12h/mês CRO (2 tardes) · não lançar sextas 02 e 30/10 N"),
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
    ("Raquel", "Raquel Assis", 24, "24h", "CP (cuidados paliativos, código CP) seg+qua manhã; NÃO tardes, NÃO quintas; máx 1 noturno/semana", "1", "não", "12h CP + 12h plantão + 24h fds · férias 05–19/10"),
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
    1:  ("grade", "Reconstruído da grade 'ESCALA FINAL JANEIRO 2026' — a grade começa no dia 2"),
    2:  ("senior", "Códigos Senior (códigos antigos 110/82/83)"),
    3:  ("senior", "Códigos Senior (códigos antigos 110/82/83)"),
    4:  ("senior", "Códigos Senior — mudança de abril: passa a 2/40/41"),
    5:  ("grade", "Reconstruído da grade; dias 1–2 vêm do arquivo de abril; DIA 3 NÃO EXISTE em nenhum arquivo"),
    6:  ("grade", "Reconstruído da grade 'Escala junho - UTI HCB'"),
    7:  ("senior", "Códigos Senior"),
    8:  ("senior", "Códigos Senior"),
    9:  ("grade", "Grade do grupo 'Escala setembro - UTI HCB' — a que a equipe segue — com os "
                  "códigos estruturais (47, 78, 6, 11), férias e licenças vindos do arquivo Senior. "
                  "O arquivo de códigos Senior de setembro estava INCOMPLETO em 29 e 30/09 (sem a "
                  "chefia e sem várias pessoas), por isso não é a fonte deste mês. As anotações "
                  "BHP/BHN da grade entram como códigos + e −"),
    10: ("montado", "ESCALA DA MARI — a versão viva do Sheet, re-transcrita em 01/09/26 "
                     "(mari_out_dados.py v2), mais as correções da checagem Marcos/Mari "
                     "(checagem_out_v3.py — cada uma listada na aba CHECAGEM OUT). Buracos "
                     "que ela deixou aparecem em vermelho na linha Falta"),
    11: ("vazio", "A montar"),
    12: ("vazio", "A montar"),
}
AVISO_GRADE = ("Meses reconstruídos da grade têm FIDELIDADE MENOR: a grade lista nomes por "
               "turno, não códigos. 10h de chefia (47), 4h de CEP (6) e 5h da Janaina (78) "
               "aparecem só como nome na coluna da manhã e entram como manhã de 6h — a carga "
               "horária desses meses fica subestimada pra chefia. Manhã+tarde no mesmo dia "
               "foi lido como 12h dia. Anotações BHP/BHN da grade viram os códigos + e − (BHN não conta hora).")

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
