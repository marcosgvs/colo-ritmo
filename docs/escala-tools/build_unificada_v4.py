#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Planilha unificada v4 — ANUAL, UTI HCB 2026.

Abas: LEIA-ME · CADASTRO · CONFIG · 12 mensais (JAN..DEZ) · PAINEL ANO · SENIOR · VALIDADOR
      · PREFS OUT · ATENDIMENTO · CONVOCAÇÕES

Princípios:
- regras vivem em CONFIG como DADO; as abas mensais apontam pra lá (mudou o
  mínimo em CONFIG, a planilha inteira se ajusta);
- todas as 12 abas têm GEOMETRIA IDÊNTICA, o que deixa SENIOR e PAINEL ANO
  espelharem qualquer mês por INDIRECT sem gambiarra;
- contagem é fórmula, nunca número digitado — o erro de contagem à mão foi o
  que gerou as dívidas de fds de agosto;
- compatível com Google Sheets: só COUNTIF/SUMPRODUCT/VLOOKUP/INDIRECT/ADDRESS,
  e formatação condicional só nas 3 linhas de "falta" (CF pesada engasga o Sheets).
"""
import datetime as dt
import os
import runpy
import sys

import openpyxl
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

import grade_import
import senior_import
import v4_dados as D
from validador import auditar, noturnas_por_mes

# ------------------------------------------------------------- identidade colo
INK, INK2, INK3 = "3A2E2A", "6B5C56", "9A8A82"
LINE, LINE2 = "EBE8E5", "DAD3CD"
CREME, CREME2 = "FFFAF3", "FAF3E8"   # bg e surface dos tokens
LAV, LAVI, LAVS = "A299CB", "5A4E8C", "ECEAF4"
AQUA, AQUAS = "9AD8E1", "E8F6F8"
SAND, SANDS = "E8C79A", "FBF1E1"
CORAL, CORALI, CORALS = "E7A59C", "C77264", "FBE9E5"
SAGE, SAGES = "A4D498", "ECF6E7"
BLUES, PINK, OLIVES = "EAF2F9", "E79BC4", "F1EFE0"
F = "Nunito"          # corpo e UI
DISPLAY = "Fraunces"  # títulos
MAO = "Caveat"        # sobretítulo à mão

FILLS = {"M": SANDS, "T": BLUES, "D": SAND, "N": LAVI, "NT": LAV, "C": "FAEAF2",
         "J": AQUAS, "E": OLIVES, "A": LINE, "FE": AQUA, "LM": SAGE, "AB": PINK}
BRANCO = {"N"}
THIN = Side(style="thin", color=LINE)
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WD_PT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
MESES_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
            "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
MESES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
               "agosto", "setembro", "outubro", "novembro", "dezembro"]

# ------------------------------------------------------------------ geometria
C_MED, C_CH = 1, 2
N_PRE = 6                     # colunas do FIM DO MÊS ANTERIOR: todo mês abre com a
                              # semana civil fechada (dia 1º cai terça → a segunda
                              # aparece). São fórmulas vivas da aba anterior — entram
                              # nas somas semanais, mas CH/FDS/saldo delas pertencem
                              # ao mês anterior (espelho da regra do dia 1º seguinte)
C_PRE1 = 3                    # primeira coluna de véspera (C)
C_D1 = C_PRE1 + N_PRE         # primeira coluna de dia (I)
C_DN = C_D1 + 30              # último dia DO MÊS (AM) — CH/FDS/saldo param aqui
N_POS = 6                     # colunas da VIRADA: a semana fecha NO DOMINGO
                              # (Marcos, 28/08), então o mês mostra os dias do mês
                              # seguinte até o domingo que fecha a última semana
                              # (nov termina seg 30/11 → aparecem 01–06/12).
                              # Fórmulas vivas da aba seguinte; contam nas somas
                              # SEMANAIS, mas a cota é do mês seguinte (doc §6)
C_D32 = C_D1 + 31             # primeira coluna da virada (AN)
N_SEM = 6                     # máximo de semanas civis que um mês encosta
COLS_TOT = (["CH mês", "FDS", "SxN", "Feriado", "Meta", "Saldo", "18h⚠", "N→T",
             "Cota FDS", "FDS⚠", "Sem⚠"]      # fds⚠ = excesso sobre cota × fator
            + [f"Sem {k}" for k in range(1, N_SEM + 1)]
            + ["Grupo",       # ordenar por tipo no funil do filtro
               "Nº"])         # posição original do cadastro — ordena de volta
IDX_GRUPO = len(COLS_TOT) - 2
IDX_NUM = len(COLS_TOT) - 1
# Grupo com prefixo numérico pra ordenar coordenação→rotina→staff→administrativo
# (o sortSpec do Sheets só sabe asc/desc). Coordenação = quem faz o 47 (doc §3).
GRUPO_COORD = {"Fred", "Milena"}
GRUPO_ROSTER = {a: g for a, _n, _c, g, *_ in D.ROSTER}
def grupo_filtro(apelido):
    if apelido in GRUPO_COORD:
        return "1 · coordenação"
    g = GRUPO_ROSTER.get(apelido, "")
    if g in ("chefia", "rotina"):
        return "2 · rotina"
    if g == "administrativo":
        return "4 · administrativo"
    return "3 · staff"
# Sem 1..6 = horas por SEMANA CIVIL (seg–dom), sempre COMPLETA: a 1ª inclui os
# dias do mês anterior e a última fecha no domingo com os dias do mês seguinte.
# A semana da virada aparece nos dois meses — é a mesma semana, medida igual.
# sem⚠ = a maior delas. Teto duro: 44h (art. 7º XIII da Constituição).
C_TOT = C_D32 + N_POS         # AT em diante
R_TIT, R_DIA, R_DOW, R_FDS, R_SEX, R_FER, R_HDR, R_P0 = 1, 2, 3, 4, 5, 6, 7, 8

L_PRE1 = get_column_letter(C_PRE1)
L_PRE2 = get_column_letter(C_PRE1 + 1)
L_D1, L_DN = get_column_letter(C_D1), get_column_letter(C_DN)
L_DN_1 = get_column_letter(C_DN - 1)
L_D2 = get_column_letter(C_D1 + 1)


def _ref_vizinho(aba, dia, lin):
    """célula do dia `dia` da pessoa desta linha na aba vizinha, PELO NOME.

    INDEX/MATCH com linhas absolutas: sobrevive à ordenação pelo filtro em
    qualquer uma das duas abas (a lição do #REF de 28/08 — referência posicional
    quebra quando as linhas se movem). O &"" evita o 0 de célula vazia.
    """
    colv = get_column_letter(C_D1 + dia - 1)
    return (f'=IFERROR(INDEX({aba}!{colv}${R_P0}:{colv}${R_P0 + 65},'
            f'MATCH($A{lin},{aba}!$A${R_P0}:$A${R_P0 + 65},0))&"","")')


def janelas_semana_civil(mes, ndias, ano=2026):
    """[[(col_ini, col_fim), …]] — cada semana civil do mês como lista de
    trechos contíguos de coluna. Toda semana é COMPLETA (segunda a domingo):
    a 1ª começa nas vésperas (C..H) e a última fecha no domingo, entrando
    pelas colunas da virada. Em mês de menos de 31 dias existe um vão de
    colunas cinzas entre o último dia e o bloco da virada — daí os trechos.
    """
    offset = dt.date(ano, mes, 1).weekday()          # seg=0 … dom=6
    janelas = []
    ini = -offset                                    # posição 0 = dia 1º
    while ini < ndias:
        fim = ini + 6
        spans = [(C_D1 + ini, C_D1 + min(fim, ndias - 1))]
        if fim >= ndias:                             # transborda pra virada
            spans.append((C_D32, C_D32 + (fim - ndias)))
        janelas.append(spans)
        ini += 7
    return janelas

# expressão de horas de uma linha de pessoa (usada em várias fórmulas)
def expr_horas(lin, c1=None, c2=None):
    a = f"${get_column_letter(c1 or C_D1)}{lin}:${get_column_letter(c2 or C_DN)}{lin}"
    partes = [f'({a}="{k}")*{v[2]}' for k, v in D.TURNOS.items() if v[2]]
    return "+".join(partes)


def carregar_dados():
    """DIAS[date][apelido] = (letra, origem) pro ano inteiro."""
    roster = [x[0] for x in D.ROSTER]
    DIAS, _ = senior_import.importar()
    grade, rel_grade = grade_import.importar(roster + [x[0] for x in D.FORA_DO_ROSTER])
    for data, pessoas in grade.items():
        for p, cel in pessoas.items():
            DIAS.setdefault(data, {}).setdefault(p, cel)   # códigos Senior têm prioridade
    # outubro: plano montado pelo v3
    # ORDEM DA MONTAGEM (dica do Marcos): fds primeiro e o mais justo possível,
    # depois o feriado, depois o resto da semana. remontar_fds.py faz nessa ordem.
    import remontar_fds
    plano, mov = remontar_fds.rodar(verbose=False)
    ns = remontar_fds.NS
    ns["_mov"] = mov
    for apelido, por_dia in plano.items():
        for dia, letra in por_dia.items():
            data = dt.date(2026, 10, dia)
            DIAS.setdefault(data, {})[apelido] = (letra, "montado")
    # POR CIMA de tudo: outubro segundo a MARI (28/08/26). Ela reescreveu a
    # proposta no Sheet vivo e a versão dela é a fonte de verdade — o plano do
    # gerador fica só como base de comparação. Substituição total: célula que
    # ela deixou vazia fica vazia (ela preferiu buraco a convocação).
    import mari_out_dados as MO
    roster = [x[0] for x in D.ROSTER]
    for data in [dt.date(2026, 10, d) for d in range(1, 32)] + [dt.date(2026, 11, 1)]:
        dia_k = 32 if data.month == 11 else data.day
        for apelido in roster:
            letra = MO.MARI.get(apelido, {}).get(dia_k)
            if letra:
                DIAS.setdefault(data, {})[apelido] = (letra, "mari")
            else:
                DIAS.get(data, {}).pop(apelido, None)
    return DIAS, rel_grade, ns


# ============================================================== abas
def _tip(cel, chave):
    """cola o tooltip do dicionário central como comentário (nota no Sheets)."""
    texto = D.TOOLTIPS.get(chave) or D.TOOLTIPS.get(str(chave).lower())
    if texto:
        cm = openpyxl.comments.Comment(texto, "colo ritmo")
        cm.width, cm.height = 320, 130
        cel.comment = cm
    return cel


def estilo_titulo(ws, texto, sub=""):
    c = ws.cell(row=1, column=1, value=texto)
    c.font = Font(name=DISPLAY, bold=True, size=15, color=INK)
    if sub:
        s = ws.cell(row=1, column=4, value=sub)
        s.font = Font(name=F, size=9, italic=True, color=INK3)
    ws.sheet_view.showGridLines = False


def creme(ws, ate_linha, ate_coluna):
    """pinta o creme por baixo de tudo — '#FFFAF3 · fundo de TUDO' nos tokens.

    Roda ANTES dos preenchimentos específicos não daria certo (a ordem de escrita
    é outra), então só pinta célula que ficou sem fill próprio.
    """
    vazio = ("00000000", None)
    for r in range(1, ate_linha + 1):
        for c in range(1, ate_coluna + 1):
            cel = ws.cell(row=r, column=c)
            if cel.fill is None or cel.fill.fgColor.rgb in vazio:
                cel.fill = PatternFill("solid", fgColor=CREME)


def aba_leiame(wb, rel_grade):
    ws = wb.create_sheet("LEIA-ME")
    ws.sheet_properties.tabColor = PINK
    estilo_titulo(ws, "Escala UTI HCB · 2026 — Planilha Unificada v4")
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 30
    for col in "CDEFGH":
        ws.column_dimensions[col].width = 17
    r = 3

    def secao(titulo):
        nonlocal r
        c = ws.cell(row=r, column=1, value=titulo)
        c.font = Font(name=DISPLAY, bold=True, size=11, color=LAVI)
        r += 1

    def linha(a, b="", cor=INK2, negrito=False):
        nonlocal r
        ws.cell(row=r, column=1, value=a).font = Font(name=F, size=10, bold=negrito, color=INK)
        if b:
            cel = ws.cell(row=r, column=2, value=b)
            cel.font = Font(name=F, size=10, color=cor)
            cel.alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
        r += 1

    secao("O que é")
    linha("", "O ano inteiro num arquivo: 12 abas mensais com a escala real, o painel "
              "comparativo do ano, a tradução pros códigos do Senior e o validador das "
              "regras que são lei. Tudo o que é contagem é fórmula — digitou o código na "
              "aba do mês, a cobertura, a carga horária, o saldo e os alertas se refazem sozinhos.")
    r += 1
    secao("Legenda dos códigos")
    ws.cell(row=r, column=1, value="código").font = Font(name=F, bold=True, size=9, color="FFFFFF")
    for i, t in enumerate(("turno", "horário", "horas", "Senior")):
        ws.cell(row=r, column=2 + i, value=t).font = Font(name=F, bold=True, size=9, color="FFFFFF")
    for c in range(1, 6):
        ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=LAVI)
    r += 1
    for letra, (rot, hora, horas, cod, *_) in D.TURNOS.items():
        cel = ws.cell(row=r, column=1, value=letra)
        cel.font = Font(name=F, bold=True, size=10,
                        color="FFFFFF" if letra in BRANCO else INK)
        cel.fill = PatternFill("solid", fgColor=FILLS.get(letra, CREME))
        cel.alignment = Alignment(horizontal="center")
        for i, v in enumerate((rot, hora, horas if horas else "—", cod or "—")):
            ws.cell(row=r, column=2 + i, value=v).font = Font(name=F, size=10, color=INK2)
        r += 1
    linha("Antigos", "Até abril de 2026 os códigos eram outros: "
          + " · ".join(f"{k} = {v}" for k, v in D.CODIGOS_ANTIGOS.items())
          + ". A mudança de abril passou a usar 2/40/41.")
    r += 1

    secao("As abas")
    for nome, desc in (
        ("CADASTRO", "Quem é quem: carga horária, restrições duras, sexta-noite e fds extra. "
                     "É a fonte dos nomes de todas as abas mensais."),
        ("CONFIG", "As regras como dado: cobertura mínima, cota de fds em mês com férias, "
                   "tabela de códigos e as regras duras com o artigo da CLT. Mudou aqui, "
                   "mudou na planilha toda."),
        ("JAN a DEZ", "A escala: matriz médico × dia, com filtro no cabeçalho pra ordenar "
                      "(veja “Ordenar” abaixo). A semana fecha NO DOMINGO, então todo "
                      "mês aparece com as semanas completas: as primeiras colunas trazem o fim "
                      "do mês anterior (dia 1º cai terça, a segunda aparece) e as últimas trazem "
                      "os dias do mês seguinte até o domingo que fecha a última semana. Esses "
                      "dias vizinhos são fórmula da aba deles — pra editar, use a aba do mês "
                      "dono do dia. No rodapé, a lotação de cada turno e quanto falta pro "
                      "mínimo. À direita, por pessoa: carga do mês, fds, sexta-noite, feriado, "
                      "meta, saldo, os alertas de jornada e as horas de cada semana civil "
                      "(Sem 1 a Sem 6, sempre a semana inteira; vermelho acima de 44h)."),
        ("Ordenar", "Cada aba mensal tem um FILTRO no cabeçalho (ícone de funil): clique no "
                    "funil de “Médico” e ordene de A a Z, ou no de “Grupo” "
                    "para ver coordenação → rotina → staff. A coluna “Nº” volta à "
                    "ordem original. A planilha foi preparada para isso: toda fórmula acha "
                    "cada pessoa PELO NOME, em qualquer ordem — ordenar pelo funil não "
                    "quebra nada. Só não use “Classificar intervalo” numa seleção "
                    "parcial, que aí as linhas se separam das colunas."),
        ("OUT · DIA A DIA", "O mês em formato calendário: por dia e por turno, quem "
                             "está onde, e a cobertura. Abre na segunda-feira da semana do "
                             "dia 1º e fecha no domingo da última semana — os dias dos meses "
                             "vizinhos aparecem acinzentados, só para leitura. É fórmula da "
                             "aba do mês — trocou um plantão no dropdown, o dia a dia se "
                             "refaz. Bom pra bater o olho e perceber o que está esquisito."),
        ("PAINEL ANO", "O comparativo do ano: saldo, fds, sexta-noite e feriado de cada pessoa "
                       "mês a mês, com acumulado. Onde existe a contagem manual antiga, ela "
                       "aparece ao lado pra conferência."),
        ("SENIOR", "Escolha o mês em B1 e a matriz inteira sai traduzida nos códigos do RH, "
                   "pronta pra lançar."),
        ("VALIDADOR", "O que fere regra dura, separado em ESTRUTURAL (é a forma do contrato, "
                      "decisão de política) e PONTUAL (erro daquele mês)."),
        ("ATENDIMENTO", "O mês vivo: o que foi atendido de cada pedido, e por quê."),
        ("CONVOCAÇÕES", "Quem foi convocado fora da preferência, com o critério público — "
                        "e as decisões do feriado, incluindo o que não foi atendido."),
    ):
        linha(nome, desc, negrito=True)
    r += 1

    secao("A ordem de montar · dica")
    linha("", D.NOTA_DICA, cor=INK2)
    for titulo, texto in D.DICA_ORDEM:
        linha(titulo, texto, negrito=True)
    r += 1

    secao("De onde vem cada mês — leia antes de comparar")
    for mes in range(1, 13):
        origem, nota = D.PROCEDENCIA[mes]
        cor = {"senior": SAGES, "grade": SANDS, "montado": LAVS, "vazio": LINE}[origem]
        cel = ws.cell(row=r, column=1, value=MESES_PT[mes - 1])
        cel.font = Font(name=F, bold=True, size=10, color=INK)
        cel.fill = PatternFill("solid", fgColor=cor)
        cel.alignment = Alignment(horizontal="center")
        c2 = ws.cell(row=r, column=2, value=nota)
        c2.font = Font(name=F, size=9, color=INK2)
        c2.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
        r += 1
    r += 1
    linha("atenção", D.AVISO_GRADE, cor=CORALI)
    r += 1
    secao("O que ainda falta")
    for falta in (
        "Maio dia 3 não existe em nenhum arquivo recebido — a coluna fica vazia.",
        "Janeiro começa no dia 2: a grade recebida não tem o dia 1º.",
        "Junho e janeiro não têm arquivo de códigos Senior; foram reconstruídos da grade.",
        "Novembro e dezembro estão em branco, prontos pra montar.",
        "Dois códigos órfãos no histórico: 23 (Isabella 23/08) e 3 (Laura 02/08) — não "
        "constam em nenhuma legenda; ficaram de fora.",
        "A coluna 18h⚠ enxerga a virada de mês pelas colunas de véspera: a noite do fim "
        "do mês anterior emendando a manhã do dia 1º conta no mês NOVO (cada virada tem "
        "um dono só, nunca é contada duas vezes). A virada dez/26→jan/27 fica com a aba "
        "VALIDADOR, que olha o ano inteiro.",
        "O seletor de mês da aba SENIOR usa INDIRECT, que só resolve com o arquivo aberto "
        "no Excel ou no Google Sheets — em pré-visualização de e-mail ou no Drive sem abrir, "
        "a matriz aparece vazia. Abrir e escolher o mês em B1 resolve.",
    ):
        linha("·", falta)
    creme(ws, r + 2, 8)
    return ws


def aba_cadastro(wb):
    ws = wb.create_sheet("CADASTRO")
    ws.sheet_properties.tabColor = AQUA
    estilo_titulo(ws, "Cadastro · Quem é quem",
                  f"{len(D.ROSTER)} pessoas ativas")
    cabecalhos = ["Médico", "Nome completo", "CH", "Grupo", "Restrições duras",
                  "Sexta-noite", "FDS extra", "Observações"]
    larguras = [14, 22, 5, 15, 58, 16, 14, 52]
    chaves_cad = {"CH": "CH", "Grupo": "grupo", "Sexta-noite": "sexta-noite ficha",
                  "FDS extra": "fds extra ficha", "Médico": "médico"}
    for i, (h, w) in enumerate(zip(cabecalhos, larguras), start=1):
        cel = ws.cell(row=3, column=i, value=h)
        cel.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        cel.fill = PatternFill("solid", fgColor=LAVI)
        cel.alignment = Alignment(horizontal="left", vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = w
        if h in chaves_cad:
            _tip(cel, chaves_cad[h])
    grupos = {"chefia": "FAEAF2", "rotina": "FAEAF2", "30h": AQUAS,
              "36h": SANDS, "24h": CREME, "administrativo": LINE}
    r = 4
    for apelido, nome, ch, grupo, restr, sn, fe, obs in D.ROSTER:
        vals = [apelido, nome, ch, grupo, restr, sn, fe, obs]
        for i, v in enumerate(vals, start=1):
            cel = ws.cell(row=r, column=i, value=v)
            cel.font = Font(name=F, size=9, color=INK, bold=(i == 1))
            cel.alignment = Alignment(wrap_text=(i in (5, 8)), vertical="top")
            cel.border = BOX
            if i == 4:
                cel.fill = PatternFill("solid", fgColor=grupos.get(grupo, CREME))
        if (r % 2) == 1:                      # banda quente alternada
            for i in range(1, 9):
                cel = ws.cell(row=r, column=i)
                if cel.fill is None or cel.fill.fgColor.rgb in ("00000000", None):
                    cel.fill = PatternFill("solid", fgColor=CREME2)
        ws.row_dimensions[r].height = 26
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="Fora do roster").font = Font(name=F, bold=True, size=10, color=CORALI)
    r += 1
    for apelido, motivo in D.FORA_DO_ROSTER:
        ws.cell(row=r, column=1, value=apelido).font = Font(name=F, size=9, bold=True, color=INK3)
        ws.cell(row=r, column=2, value=motivo).font = Font(name=F, size=9, color=INK3)
        r += 1
    creme(ws, r + 2, 8)
    ws.freeze_panes = "C4"
    return ws


def aba_config(wb):
    ws = wb.create_sheet("CONFIG")
    ws.sheet_properties.tabColor = SAGE
    estilo_titulo(ws, "Config · As regras como dado",
                  "Mudou aqui, muda na planilha toda")
    for col, w in zip("ABCDEFG", (18, 13, 13, 13, 13, 44, 44)):
        ws.column_dimensions[col].width = w

    def cab(r, textos):
        for i, t in enumerate(textos, start=1):
            cel = ws.cell(row=r, column=i, value=t)
            cel.font = Font(name=F, bold=True, size=9, color="FFFFFF")
            cel.fill = PatternFill("solid", fgColor=LAVI)

    # cobertura mínima — DOIS blocos, porque a regra mudou em outubro/26.
    # Linhas 4-6 = regra em vigor · linhas 9-11 = regra antiga (jan–set).
    # As abas mensais apontam para o bloco da vigência do próprio mês.
    ws.cell(row=3, column=1, value="Cobertura mínima por turno").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    cab(3, ["Em vigor · de out/26", "Manhã", "Tarde", "Noite"])
    for i, tipo in enumerate(("útil", "sábado", "domingo")):
        m, t, n = D.MINIMOS[tipo]
        ws.cell(row=4 + i, column=1, value=tipo).font = Font(name=F, size=10, bold=True, color=INK)
        for j, v in enumerate((m, t, n)):
            cel = ws.cell(row=4 + i, column=2 + j, value=v)
            cel.font = Font(name=F, size=11, bold=True, color=LAVI)
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
    nota = ws.cell(row=4, column=6, value=D.NOTA_MINIMOS)
    nota.font = Font(name=F, size=9, color=INK2)
    nota.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=4, start_column=6, end_row=7, end_column=7)
    cab(8, ["Até set/26 · histórico", "Manhã", "Tarde", "Noite"])
    for i, tipo in enumerate(("útil", "sábado", "domingo")):
        m, t, n = D.MINIMOS_ANTIGOS[tipo]
        ws.cell(row=9 + i, column=1, value=tipo).font = Font(name=F, size=10, color=INK2)
        for j, v in enumerate((m, t, n)):
            cel = ws.cell(row=9 + i, column=2 + j, value=v)
            cel.font = Font(name=F, size=10, color=INK2)
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
    nota2 = ws.cell(row=9, column=6, value="Os meses de janeiro a setembro são medidos "
                    "por ESTA regra. Cobrar deles o mínimo novo seria exigir do passado "
                    "uma regra que ainda não existia.")
    nota2.font = Font(name=F, size=9, italic=True, color=INK3)
    nota2.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=9, start_column=6, end_row=11, end_column=7)

    # tabela de códigos — linhas 9..20, referenciada pela aba SENIOR
    ws.cell(row=13, column=1, value="Tabela de códigos").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    cab(14, ["Letra", "Senior", "Horas", "Conta manhã", "Conta tarde", "Conta noite", "Turno"])
    for cc in range(4, 7):
        _tip(ws.cell(row=14, column=cc), "conta-flags")
    r = 15
    for letra, (rot, hora, horas, cod, cm, ct, cn) in D.TURNOS.items():
        ws.cell(row=r, column=1, value=letra).font = Font(name=F, bold=True, size=10, color=INK)
        ws.cell(row=r, column=2, value=cod or "")
        ws.cell(row=r, column=3, value=horas)
        ws.cell(row=r, column=4, value=cm)
        ws.cell(row=r, column=5, value=ct)
        ws.cell(row=r, column=6, value=cn)
        ws.cell(row=r, column=7, value=f"{rot} · {hora}")
        for c in range(1, 8):
            ws.cell(row=r, column=c).font = Font(
                name=F, size=9, color=INK, bold=(c == 1))
            ws.cell(row=r, column=c).border = BOX
        r += 1
    fim_cod = r - 1

    # cota de fds em férias
    r += 1
    ws.cell(row=r, column=1, value="Cota de FDS em mês com férias").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    r += 1
    cab(r, ["CH semanal", "Férias 2 sem", "Férias 1 sem", "Sem férias"])
    r += 1
    r_cota = r                      # as abas mensais apontam para cá
    fl = ws.cell(row=r - 2, column=6, value=(
        "Em mês de 5 fins de semana a demanda de fds passa da soma das cotas do "
        "grupo e zerar o excesso é aritmeticamente impossível. Outubro/26: demanda "
        "1704h contra 1494h de cota somada — 210h que não têm de onde sair. O alvo "
        "de cada pessoa passa a ser a cota vezes o fator abaixo, para que o excesso "
        "inevitável seja dividido em proporção e não despejado em quem tem menos veto."))
    fl.font = Font(name=F, size=9, italic=True, color=INK2)
    fl.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r - 2, start_column=6, end_row=r + 2, end_column=7)
    cfat = ws.cell(row=r - 1, column=5, value="Fator do mês")
    cfat.font = Font(name=F, size=9, bold=True, color=INK)
    _tip(cfat, "fator")
    cf_fator = ws.cell(row=r, column=5, value=1.141)
    cf_fator.font = Font(name=F, size=11, bold=True, color=LAVI)
    cf_fator.number_format = "0.000"
    cf_fator.alignment = Alignment(horizontal="center")
    cf_fator.border = BOX
    for ch, duas, uma, sem in D.COTA_FDS_FERIAS:
        for j, v in enumerate((ch, duas, uma, sem)):
            cel = ws.cell(row=r, column=1 + j, value=v)
            cel.font = Font(name=F, size=10, color=INK, bold=(j == 0))
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
        r += 1

    # feriados do ano — eram dado escondido no Python; agora vivem aqui
    r += 1
    ws.cell(row=r, column=1, value="Feriados de 2026").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    nf = ws.cell(row=r, column=5, value=D.NOTA_FERIADOS)
    nf.font = Font(name=F, size=9, color=INK2)
    nf.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=5, end_row=r + 5, end_column=7)
    r += 1
    cab(r, ["Data", "Sigla", "Feriado"])
    r += 1
    for (mes, dia), (nome_f, sigla) in sorted(D.FERIADOS_2026.items()):
        data = dt.date(2026, mes, dia)
        cel = ws.cell(row=r, column=1, value=f"{dia:02d}/{mes:02d} ({WD_PT[data.weekday()]})")
        cel.font = Font(name=F, size=9, bold=True, color=INK)
        sg = ws.cell(row=r, column=2, value=sigla)
        sg.font = Font(name=F, size=9, bold=True, color="FFFFFF")
        sg.fill = PatternFill("solid", fgColor=CORALI)
        sg.alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=3, value=nome_f).font = Font(name=F, size=9, color=INK2)
        for c in range(1, 4):
            ws.cell(row=r, column=c).border = BOX
        r += 1

    # regras duras
    r += 1
    ws.cell(row=r, column=1, value="Regras duras").font = Font(name=DISPLAY, bold=True, size=11, color=LAVI)
    r += 1
    cab(r, ["Regra", "O que é", "Base", "Tratamento", "Nota"])
    ws.cell(row=r, column=2).value = "o que é"
    r += 1
    cores = {"ALERTA": CORALS, "REGISTRO": OLIVES, "CÁLCULO": AQUAS, "PREFERÊNCIA": CREME}
    for nome, oque, base, trat, nota_txt in D.REGRAS_DURAS:
        ws.cell(row=r, column=1, value=nome).font = Font(name=F, size=9, bold=True, color=INK)
        for i, v in enumerate((oque, base, trat), start=2):
            ws.cell(row=r, column=i, value=v).font = Font(name=F, size=9, color=INK2)
        ws.cell(row=r, column=4).fill = PatternFill("solid", fgColor=cores.get(trat, CREME))
        cel = ws.cell(row=r, column=5, value=nota_txt)
        cel.font = Font(name=F, size=9, color=INK2)
        cel.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
        ws.row_dimensions[r].height = 30
        r += 1
    creme(ws, r + 2, 7)
    return ws, fim_cod, r_cota


def _atend_do_v3():
    """extrai o literal ATEND de gerar_saidas.py sem executar o resto do arquivo."""
    src = open(os.path.join(AQUI, "gerar_saidas.py"), encoding="utf-8").read()
    ini = src.index("ATEND = [")
    fim = src.index("\n]", ini) + 2
    ns = {}
    exec(src[ini:fim], {}, ns)
    return ns["ATEND"]


def aba_mes(wb, mes, DIAS, fim_cod, pessoas, r_cota):
    nome = MESES_PT[mes - 1]
    ws = wb.create_sheet(nome)
    origem, nota = D.PROCEDENCIA[mes]
    ws.sheet_properties.tabColor = {"senior": SAGE, "grade": SAND,
                                   "montado": LAV, "vazio": LINE}[origem]
    ws.sheet_view.showGridLines = False
    ndias = (dt.date(2026, mes % 12 + 1, 1) - dt.timedelta(days=1)).day if mes < 12 else 31

    t = ws.cell(row=R_TIT, column=1, value=f"{MESES_LONGO[mes-1].capitalize()} · 2026")
    t.font = Font(name=DISPLAY, bold=True, size=14, color=INK)
    t.comment = openpyxl.comments.Comment(f"De onde vem este mês: {nota}", "colo ritmo")
    # legenda compacta sempre à vista — pra ninguém precisar decorar as siglas
    sub = ws.cell(row=R_TIT, column=C_D1 + 6, value=(
        "Legenda: M manhã 7–13 · T tarde 13–19 · D dia 7–19 · N noite 19–7 · "
        "NT noitinha · C chefia 10h · J Janaina 8–13 · E CEP · FE férias · "
        "LM licença · AB abono"))
    sub.font = Font(name=F, size=8, italic=True, color=INK3)

    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 5
    # vésperas: o fim do mês anterior que fecha a 1ª semana civil (seg–dom).
    # Valores vêm POR FÓRMULA da aba anterior — trocou lá, atualiza aqui.
    # Máscaras zeradas: véspera não conta em CH/FDS/saldo deste mês.
    offset = dt.date(2026, mes, 1).weekday()       # quantas vésperas o mês pede
    aba_prev = MESES_PT[mes - 2] if mes > 1 else None
    # virada: a semana fecha NO DOMINGO — os dias do mês seguinte até esse
    # domingo aparecem depois do dia final, por fórmula da aba seguinte
    n_virada = (7 - ((offset + ndias) % 7)) % 7
    aba_prox = MESES_PT[mes % 12] if mes < 12 else None
    prox1 = dt.date(2026 + (1 if mes == 12 else 0), mes % 12 + 1, 1)
    dias_virada = [prox1 + dt.timedelta(days=j) for j in range(n_virada)]
    for j in range(N_POS):
        col = C_D32 + j
        for rr in (R_FDS, R_SEX, R_FER):
            ws.cell(row=rr, column=col, value=0)   # cota é do mês seguinte
        if j >= n_virada:
            ws.column_dimensions[get_column_letter(col)].width = 2.5
            for rr in (R_DIA, R_DOW):
                ws.cell(row=rr, column=col).fill = PatternFill("solid", fgColor=LINE)
            continue
        d_prox = dias_virada[j]
        ws.column_dimensions[get_column_letter(col)].width = 4.2
        cd = ws.cell(row=R_DIA, column=col, value=d_prox.strftime("%d/%m"))
        cd.font = Font(name=F, bold=True, size=7, color=INK2)
        cd.alignment = Alignment(horizontal="center")
        cd.fill = PatternFill("solid", fgColor=LAVS if d_prox.weekday() >= 5 else CREME2)
        cw = ws.cell(row=R_DOW, column=col, value=WD_PT[d_prox.weekday()])
        cw.font = Font(name=F, size=8, color=CORALI if d_prox.weekday() >= 5 else INK3)
        cw.alignment = Alignment(horizontal="center")
        _tip(cd, "dia-seguinte")
    for j in range(N_PRE):
        col = C_PRE1 + j
        usada = j >= N_PRE - offset
        for rr in (R_FDS, R_SEX, R_FER):
            ws.cell(row=rr, column=col, value=0)
        if not usada:
            ws.column_dimensions[get_column_letter(col)].width = 2.5
            for rr in (R_DIA, R_DOW):
                ws.cell(row=rr, column=col).fill = PatternFill("solid", fgColor=LINE)
            continue
        ws.column_dimensions[get_column_letter(col)].width = 4.2
        d_prev = dt.date(2026, mes, 1) - dt.timedelta(days=N_PRE - j)
        cd = ws.cell(row=R_DIA, column=col, value=d_prev.strftime("%d/%m"))
        cd.font = Font(name=F, bold=True, size=7, color=INK2)
        cd.alignment = Alignment(horizontal="center")
        cd.fill = PatternFill("solid", fgColor=LAVS if d_prev.weekday() >= 5 else CREME2)
        cw = ws.cell(row=R_DOW, column=col, value=WD_PT[d_prev.weekday()])
        cw.font = Font(name=F, size=8, color=CORALI if d_prev.weekday() >= 5 else INK3)
        cw.alignment = Alignment(horizontal="center")
        _tip(cd, "dia-anterior")
    # cabeçalho de dias + máscaras
    for i in range(31):
        col = C_D1 + i
        letra = get_column_letter(col)
        ws.column_dimensions[letra].width = 4.2
        if i >= ndias:
            for r in (R_DIA, R_DOW):
                ws.cell(row=r, column=col).fill = PatternFill("solid", fgColor=LINE)
            continue
        data = dt.date(2026, mes, i + 1)
        fds = 1 if data.weekday() >= 5 else 0
        info_fer = D.FERIADOS_2026.get((mes, i + 1))
        feriado = 1 if info_fer else 0
        cd = ws.cell(row=R_DIA, column=col, value=i + 1)
        cd.font = Font(name=F, bold=True, size=9, color=INK)
        cd.alignment = Alignment(horizontal="center")
        # no feriado a coluna mostra a sigla do feriado em vez do dia da semana:
        # é a informação que muda a decisão, e o dia da semana se deduz do número
        rotulo = info_fer[1] if feriado else WD_PT[data.weekday()]
        cw = ws.cell(row=R_DOW, column=col, value=rotulo)
        cw.font = Font(name=F, size=8, bold=bool(feriado),
                       color="FFFFFF" if feriado else (CORALI if fds else INK3))
        cw.alignment = Alignment(horizontal="center")
        if feriado:
            cd.fill = PatternFill("solid", fgColor=CORAL)
            cd.font = Font(name=F, bold=True, size=9, color="FFFFFF")
            cw.fill = PatternFill("solid", fgColor=CORALI)
            cd.comment = openpyxl.comments.Comment(
                f"{info_fer[0]} — feriado.\n\nEscala como {WD_PT[data.weekday()]}: "
                f"a lotação exigida NÃO cai.", "colo ritmo")
        elif fds:
            cd.fill = PatternFill("solid", fgColor=LAVS)
        ws.cell(row=R_FDS, column=col, value=fds)
        ws.cell(row=R_SEX, column=col, value=1 if data.weekday() == 4 else 0)
        ws.cell(row=R_FER, column=col, value=feriado)
    for r in (R_FDS, R_SEX, R_FER):
        ws.row_dimensions[r].hidden = True
        ws.cell(row=r, column=1, value={R_FDS: "máscara fds", R_SEX: "máscara sexta",
                                        R_FER: "máscara feriado"}[r])

    # cabeçalho da matriz
    for col, txt in ((C_MED, "Médico"), (C_CH, "CH")):
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        _tip(c, txt)
    for i, txt in enumerate(COLS_TOT):
        col = C_TOT + i
        c = _tip(ws.cell(row=R_HDR, column=col, value=txt),
                 "sem-n" if txt.startswith("Sem ") else
                 ("grupo-filtro" if txt == "Grupo" else
                  ("ordem-original" if txt == "Nº" else txt)))
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=CORALI if 6 <= i <= 10 else LAVI)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = \
            7.5 if i <= 10 else (13 if txt == "Grupo" else (4.5 if txt == "Nº" else 6))

    semanas = round(ndias / 7, 2)
    for k, (apelido, ch) in enumerate(pessoas):
        lin = R_P0 + k
        cm = ws.cell(row=lin, column=C_MED, value=apelido)
        cm.font = Font(name=F, size=9, bold=True, color=INK)
        cc = ws.cell(row=lin, column=C_CH, value=ch)
        cc.font = Font(name=F, size=8, color=INK3)
        cc.alignment = Alignment(horizontal="center")
        for j in range(N_PRE):
            col = C_PRE1 + j
            c = ws.cell(row=lin, column=col)
            if j < N_PRE - offset or not aba_prev:
                c.fill = PatternFill("solid", fgColor=LINE)
                continue
            d_prev = dt.date(2026, mes, 1) - dt.timedelta(days=N_PRE - j)
            # busca PELO NOME (não pela posição): a aba pode ser ordenada pelo
            # filtro — em qualquer ordem, de cá ou de lá, a fórmula acha a pessoa
            c.value = _ref_vizinho(aba_prev, d_prev.day, lin)
            c.font = Font(name=F, size=9, color=INK2)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            c.fill = PatternFill("solid",
                                 fgColor=LAVS if d_prev.weekday() >= 5 else CREME2)
        for i in range(ndias):
            col = C_D1 + i
            data = dt.date(2026, mes, i + 1)
            cel = DIAS.get(data, {}).get(apelido)
            c = ws.cell(row=lin, column=col)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            if cel:
                letra = cel[0]
                c.value = letra
                c.font = Font(name=F, size=9, bold=True,
                              color="FFFFFF" if letra in BRANCO else INK)
                if letra in FILLS:
                    c.fill = PatternFill("solid", fgColor=FILLS[letra])
            else:
                c.font = Font(name=F, size=9, color=INK)
        for i in range(ndias, 31):
            ws.cell(row=lin, column=C_D1 + i).fill = PatternFill("solid", fgColor=LINE)
        # virada: fórmulas vivas da aba do mês seguinte (editar é LÁ — aqui é
        # conferência da semana que fecha no domingo), busca pelo nome
        for j in range(N_POS):
            col = C_D32 + j
            c = ws.cell(row=lin, column=col)
            if j >= n_virada or not aba_prox:
                c.fill = PatternFill("solid", fgColor=LINE)
                continue
            d_prox = dias_virada[j]
            c.value = _ref_vizinho(aba_prox, d_prox.day, lin)
            c.font = Font(name=F, size=9, color=INK2)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            c.fill = PatternFill("solid",
                                 fgColor=LAVS if d_prox.weekday() >= 5 else CREME2)

        eh = expr_horas(lin)
        # semanas civis do mês: a 1ª pega as vésperas; sem⚠ = MAX(Sem 1..N)
        jans = janelas_semana_civil(mes, ndias)
        col_s1 = get_column_letter(C_TOT + 11)
        col_sf = get_column_letter(C_TOT + 10 + N_SEM)
        f = [f"=SUMPRODUCT({eh})",
             f"=SUMPRODUCT(${L_D1}${R_FDS}:${L_DN}${R_FDS},{eh})",
             f'=SUMPRODUCT(${L_D1}${R_SEX}:${L_DN}${R_SEX},(${L_D1}{lin}:${L_DN}{lin}="N")*1)',
             f"=SUMPRODUCT(${L_D1}${R_FER}:${L_DN}${R_FER},{eh})",
             f"=ROUND({get_column_letter(C_CH)}{lin}*{semanas},0)",
             f"={get_column_letter(C_TOT)}{lin}-{get_column_letter(C_TOT+4)}{lin}",
             # começa nas vésperas: a noite do fim do mês anterior emendando a
             # manhã do dia 1º agora é vista aqui (a do dia 31→1º seguinte é
             # vista na aba do mês seguinte — cada virada tem um dono só)
             f'=SUMPRODUCT((${L_PRE1}{lin}:${L_DN_1}{lin}="N")*'
             f'((${L_PRE2}{lin}:${L_DN}{lin}="M")+(${L_PRE2}{lin}:${L_DN}{lin}="E")'
             f'+(${L_PRE2}{lin}:${L_DN}{lin}="C")+(${L_PRE2}{lin}:${L_DN}{lin}="D")))',
             f'=SUMPRODUCT((${L_PRE1}{lin}:${L_DN_1}{lin}="N")*(${L_PRE2}{lin}:${L_DN}{lin}="T"))',
             # cota de fds: base pela CH, reduzida conforme as semanas de férias no mês.
             # A regra vive em CONFIG; aqui só se aponta pra lá. CH fora da tabela
             # (40h) fica em branco de propósito: o doc diz "40h segue caso a caso".
             f'=IFERROR(INDEX(CONFIG!$B${r_cota}:$D${r_cota+2},'
             f'MATCH(${get_column_letter(C_CH)}{lin},CONFIG!$A${r_cota}:$A${r_cota+2},0),'
             f'IF(COUNTIF(${L_D1}{lin}:${L_DN}{lin},"FE")>=10,1,'
             f'IF(COUNTIF(${L_D1}{lin}:${L_DN}{lin},"FE")>=1,2,3))),"")',
             # alerta contra o ALVO proporcional (cota × fator do mês), não contra a
             # cota crua: em mês de 5 fds o excesso é inevitável e o que importa é
             # se a pessoa carrega mais do que a fatia dela
             f'=IF({get_column_letter(C_TOT+8)}{lin}="","",'
             f'MAX(0,{get_column_letter(C_TOT+1)}{lin}-'
             f'{get_column_letter(C_TOT+8)}{lin}*CONFIG!$E${r_cota}))',
             f"=MAX({col_s1}{lin}:{col_sf}{lin})"]
        f += ["=" + "+".join(f"SUMPRODUCT({expr_horas(lin, a2, b2)})"
                             for a2, b2 in spans) for spans in jans]
        f += [""] * (N_SEM - len(jans))
        for i, formula in enumerate(f):
            c = ws.cell(row=lin, column=C_TOT + i, value=formula or None)
            c.number_format = "0"      # hora aqui é inteira; meta já vem arredondada
            c.font = Font(name=F, size=8, color=INK2 if (i < 5 or i > 10) else INK)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            if i == 5:
                c.font = Font(name=F, size=8, bold=True, color=INK)
        cg = ws.cell(row=lin, column=C_TOT + IDX_GRUPO, value=grupo_filtro(apelido))
        cg.font = Font(name=F, size=8, color=INK3)
        cg.border = BOX
        cn = ws.cell(row=lin, column=C_TOT + IDX_NUM, value=k + 1)
        cn.font = Font(name=F, size=8, color=INK3)
        cn.alignment = Alignment(horizontal="center")
        cn.border = BOX

    ultima = R_P0 + len(pessoas) - 1
    # ------- rodapé: lotação e falta
    r = ultima + 2
    # os grupos derivam dos flags da tabela de turnos (CONFIG colunas "conta ...").
    # Não repetir a lista à mão: foi assim que P/R entraram na cobertura sem querer.
    grupos = [(rot, [k for k, v in D.TURNOS.items() if v[4 + i]], i)
              for i, rot in enumerate(("Manhã", "Tarde", "Noite"))]
    linhas_falta = []
    for gi, (rot, letras, idx) in enumerate(grupos):
        rl = r + gi
        cl = ws.cell(row=rl, column=C_MED, value=rot)
        cl.font = Font(name=F, size=9, bold=True, color=LAVI)
        _tip(cl, "cob-turno")
        rf = r + 3 + gi
        cf0 = ws.cell(row=rf, column=C_MED, value=f"Falta {rot.lower()}")
        cf0.font = Font(name=F, size=9, bold=True, color=CORALI)
        _tip(cf0, "falta")
        linhas_falta.append(rf)
        # vésperas entram na contagem visual (a semana inteira à vista);
        # o dashboard só varre C_D1..C_DN, então elas não poluem a média do mês
        vesperas = ([(-k, dt.date(2026, mes, 1) - dt.timedelta(days=k))
                     for k in range(offset, 0, -1)] if aba_prev else [])
        virada = ([(31 + j, dias_virada[j]) for j in range(n_virada)]
                  if aba_prox else [])
        for i, data in vesperas + \
                [(i2, dt.date(2026, mes, i2 + 1)) for i2 in range(ndias)] + virada:
            col = get_column_letter(C_D1 + i)
            faixa = f"{col}{R_P0}:{col}{ultima}"
            conta = "+".join(f'COUNTIF({faixa},"{x}")' for x in letras)
            c = ws.cell(row=rl, column=C_D1 + i, value=f"={conta}")
            c.font = Font(name=F, size=8, color=INK2)
            c.alignment = Alignment(horizontal="center")
            # feriado escala como o dia da semana em que cai; véspera e dia 32
            # usam a vigência do mês a que pertencem (SET→01/10 já é regra nova)
            mes_do_dia = (mes - 1) if i < 0 else (mes if i < 31 else mes % 12 + 1)
            base = 4 if mes_do_dia >= D.VIGENCIA_NOVA else 9
            tipo = base + (0 if data.weekday() < 5 else (1 if data.weekday() == 5 else 2))
            ref = f"CONFIG!${get_column_letter(2+idx)}${tipo}"
            cf = ws.cell(row=rf, column=C_D1 + i,
                         value=f"=MAX(0,{ref}-{col}{rl})")
            cf.font = Font(name=F, size=8, bold=True, color=CORALI)
            cf.alignment = Alignment(horizontal="center")
    # Sem⚠ e as semanas civis: vermelho acima do teto constitucional de 44h
    faixa_sem = (f"{get_column_letter(C_TOT + 10)}{R_P0}:"
                 f"{get_column_letter(C_TOT + 10 + N_SEM)}{ultima}")
    ws.conditional_formatting.add(
        faixa_sem,
        CellIsRule(operator="greaterThan", formula=["44"],
                   fill=PatternFill("solid", bgColor=CORAL),
                   font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    col_exc = get_column_letter(C_TOT + 9)
    ws.conditional_formatting.add(
        f"{col_exc}{R_P0}:{col_exc}{ultima}",
        CellIsRule(operator="greaterThan", formula=["0"],
                   fill=PatternFill("solid", bgColor=CORAL),
                   font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    for rf in linhas_falta:
        faixa = f"{L_PRE1}{rf}:{get_column_letter(C_D32 + N_POS - 1)}{rf}"
        ws.conditional_formatting.add(faixa, CellIsRule(
            operator="greaterThan", formula=["0"],
            fill=PatternFill("solid", bgColor=CORAL),
            font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    creme(ws, linhas_falta[-1] + 2, C_TOT + len(COLS_TOT))
    ws.freeze_panes = f"{L_PRE1}{R_P0}"
    return ws


def aba_painel(wb, pessoas, oficial):
    ws = wb.create_sheet("PAINEL ANO")
    ws.sheet_properties.tabColor = LAVI
    estilo_titulo(ws, "Painel do ano · O comparativo",
                  "Cada número vem da aba do mês — não se digita nada aqui")
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 5
    ws.cell(row=R_HDR, column=C_MED, value="Médico").font = Font(
        name=F, bold=True, size=9, color="FFFFFF")
    ws.cell(row=R_HDR, column=C_MED).fill = PatternFill("solid", fgColor=LAVI)
    ws.cell(row=R_HDR, column=C_CH, value="CH").font = Font(
        name=F, bold=True, size=9, color="FFFFFF")
    ws.cell(row=R_HDR, column=C_CH).fill = PatternFill("solid", fgColor=LAVI)

    # 4 blocos de 13 colunas (12 meses + total)
    blocos = [("Saldo do mês (h)", C_TOT + 5, LAVS),
              ("FDS (h)", C_TOT + 1, AQUAS),
              ("Sexta-noite", C_TOT + 2, SANDS),
              ("Feriado (h)", C_TOT + 3, CORALS)]
    chave_bloco = {"Saldo do mês (h)": "saldo-bloco", "FDS (h)": "fds-bloco",
                   "Sexta-noite": "sxn-bloco", "Feriado (h)": "feriado-bloco"}
    col = 3
    inicio_bloco = {}
    for rot, col_origem, cor in blocos:
        cb = ws.cell(row=R_DOW, column=col, value=rot)
        cb.font = Font(name=F, bold=True, size=10, color=LAVI)
        _tip(cb, chave_bloco.get(rot, ""))
        ws.merge_cells(start_row=R_DOW, start_column=col, end_row=R_DOW, end_column=col + 12)
        inicio_bloco[rot] = col
        for i, m in enumerate(MESES_PT):
            c = ws.cell(row=R_HDR, column=col + i, value=m)
            c.font = Font(name=F, bold=True, size=8, color=INK)
            c.fill = PatternFill("solid", fgColor=cor)
            c.alignment = Alignment(horizontal="center")
            ws.column_dimensions[get_column_letter(col + i)].width = 5.4
        c = ws.cell(row=R_HDR, column=col + 12, value="Ano")
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        c.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(col + 12)].width = 6.5
        for k in range(len(pessoas)):
            lin = R_P0 + k
            for i, m in enumerate(MESES_PT):
                # pelo NOME, não pela posição: a aba do mês pode estar ordenada
                # pelo filtro e o painel continua achando cada pessoa
                lc = get_column_letter(col_origem)
                cel = ws.cell(row=lin, column=col + i, value=(
                    f"=IFERROR(INDEX({m}!${lc}${R_P0}:${lc}${R_P0+65},"
                    f"MATCH($A{lin},{m}!$A${R_P0}:$A${R_P0+65},0)),\"\")"))
                cel.number_format = "0"
                cel.font = Font(name=F, size=8, color=INK2)
                cel.alignment = Alignment(horizontal="center")
            tot = ws.cell(row=lin, column=col + 12,
                          value=f"=SUM({get_column_letter(col)}{lin}:"
                                f"{get_column_letter(col+11)}{lin})")
            tot.number_format = "0"
            tot.font = Font(name=F, size=8, bold=True, color=INK)
            tot.alignment = Alignment(horizontal="center")
            tot.fill = PatternFill("solid", fgColor=CREME)
        col += 14

    # conferência com a contagem manual antiga
    ws.cell(row=R_DOW, column=col, value="Conferência · contagem manual antiga").font = Font(
        name=F, bold=True, size=10, color=CORALI)
    ws.merge_cells(start_row=R_DOW, start_column=col, end_row=R_DOW, end_column=col + 3)
    chave_conf = {"SxN oficial": "sxn-oficial", "SxN calc": "sxn-calc", "difere?": "difere"}
    for i, h in enumerate(("SxN oficial", "SxN calc", "difere?", "")):
        if not h:
            continue
        c = _tip(ws.cell(row=R_HDR, column=col + i, value=h), chave_conf.get(h, ""))
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=CORALI)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col + i)].width = 9

    for k, (apelido, _ch) in enumerate(pessoas):
        lin = R_P0 + k
        c = ws.cell(row=lin, column=C_MED, value=apelido)
        c.font = Font(name=F, size=9, bold=True, color=INK)
        ws.cell(row=lin, column=C_CH,
                value=f"=CADASTRO!$C{4+k}").font = Font(name=F, size=8, color=INK3)
        tem_oficial = any(n == apelido for n, _m in oficial)
        sxn_of = sum(v for (n, _m), v in oficial.items() if n == apelido)
        cel = ws.cell(row=lin, column=col, value=sxn_of if tem_oficial else None)
        cel.font = Font(name=F, size=8, color=INK3)
        cel.alignment = Alignment(horizontal="center")
        base = get_column_letter(inicio_bloco["Sexta-noite"])
        fim = get_column_letter(inicio_bloco["Sexta-noite"] + 11)
        cc = ws.cell(row=lin, column=col + 1, value=f"=SUM({base}{lin}:{fim}{lin})")
        cc.font = Font(name=F, size=8, color=INK2)
        cc.alignment = Alignment(horizontal="center")
        L = get_column_letter(col)
        cd = ws.cell(row=lin, column=col + 2,
                     value=f'=IF({L}{lin}="","",IF({L}{lin}={get_column_letter(col+1)}{lin},"","⚠"))')
        cd.font = Font(name=F, size=9, bold=True, color=CORALI)
        cd.alignment = Alignment(horizontal="center")
    creme(ws, R_P0 + len(pessoas) + 1, col + 4)
    ws.freeze_panes = "C8"
    return ws


def aba_senior(wb, pessoas, fim_cod):
    ws = wb.create_sheet("SENIOR")
    ws.sheet_properties.tabColor = SAND
    ws.sheet_view.showGridLines = False
    t = ws.cell(row=R_TIT, column=1, value="Códigos Senior")
    t.font = Font(name=DISPLAY, bold=True, size=14, color=INK)
    sel = ws.cell(row=R_TIT, column=C_CH, value="OUT")
    sel.font = Font(name=F, bold=True, size=13, color=CORALI)
    sel.fill = PatternFill("solid", fgColor=SANDS)
    sel.alignment = Alignment(horizontal="center")
    dv = DataValidation(type="list", formula1='"' + ",".join(MESES_PT) + '"',
                        allow_blank=False, showDropDown=False)
    ws.add_data_validation(dv)
    dv.add(sel)
    inst = ws.cell(row=R_TIT, column=3,
                   value="Escolha o mês na célula ao lado — a matriz inteira se traduz "
                         "nos códigos do RH, pronta para lançar no Senior")
    inst.font = Font(name=F, size=9, italic=True, color=INK3)

    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 6
    for col, txt in ((C_MED, "Médico"), (C_CH, "Apelido")):
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
    # a matriz aqui é compacta (dia 1º na coluna C): as vésperas do mês anterior
    # NÃO entram — código do RH se lança uma vez, no mês dono do dia. Por isso o
    # salto de N_PRE colunas ao mirar a aba mensal.
    S_D1 = 3
    for i in range(32):
        col = S_D1 + i
        alvo = get_column_letter(col + N_PRE)
        ws.column_dimensions[get_column_letter(col)].width = 5
        for r, formula in ((R_DIA, f'=IFERROR(INDIRECT($B$1&"!{alvo}{R_DIA}"),"")'),
                           (R_DOW, f'=IFERROR(INDIRECT($B$1&"!{alvo}{R_DOW}"),"")')):
            c = ws.cell(row=r, column=col, value=formula)
            c.font = Font(name=F, bold=(r == R_DIA), size=8, color=INK if r == R_DIA else INK3)
            c.alignment = Alignment(horizontal="center")

    nomes = {a: n for a, n, *_ in D.ROSTER}
    faixa_cod = f"CONFIG!$A$15:$B${fim_cod}"
    for k, (apelido, _ch) in enumerate(pessoas):
        lin = R_P0 + k
        c = ws.cell(row=lin, column=C_MED, value=nomes.get(apelido, apelido))
        c.font = Font(name=F, size=9, color=INK)
        # apelido na coluna B: é por ele que cada célula ACHA a pessoa na aba
        # do mês (MATCH pelo nome — a aba pode estar ordenada pelo filtro)
        cb = ws.cell(row=lin, column=2, value=apelido)
        cb.font = Font(name=F, size=7, color=INK3)
        for i in range(32):
            col = S_D1 + i
            cel = ws.cell(row=lin, column=col, value=(
                f'=IFERROR(VLOOKUP(INDEX('
                f'INDIRECT($B$1&"!"&ADDRESS({R_P0},COLUMN()+{N_PRE},4)&":"'
                f'&ADDRESS({R_P0+65},COLUMN()+{N_PRE},4)),'
                f'MATCH($B{lin},INDIRECT($B$1&"!$A${R_P0}:$A${R_P0+65}"),0)),'
                f'{faixa_cod},2,FALSE),"")'))
            cel.font = Font(name=F, size=8, color=INK)
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
    creme(ws, R_P0 + len(pessoas) + 1, S_D1 + 32)
    ws.freeze_panes = f"{get_column_letter(S_D1)}{R_P0}"
    return ws


def aba_dia_a_dia(wb, mes=10):
    """o mês em formato calendário: por dia, por turno, quem está onde.

    Tudo FÓRMULA sobre a aba do mês (FILTER + TEXTJOIN, que existem no Google
    Sheets e no Excel 365): trocou um plantão no dropdown da matriz, este
    calendário se refaz. Serve pra "perceber o que tá esquisito" — pedido do
    Marcos em 18/08/26.
    """
    nome_mes = MESES_PT[mes - 1]
    ws = wb.create_sheet(f"{nome_mes} · DIA A DIA",
                         wb.sheetnames.index(nome_mes) + 1)
    ws.sheet_properties.tabColor = CORALI
    ws.sheet_view.showGridLines = False
    t = ws.cell(row=1, column=1, value=f"{MESES_LONGO[mes-1].capitalize()} · Dia a dia")
    t.font = Font(name=DISPLAY, bold=True, size=14, color=INK)
    sub = ws.cell(row=1, column=4, value=(
        "Cada célula lista quem está no turno — é fórmula da aba do mês: "
        "mudou lá, muda aqui na hora"))
    sub.font = Font(name=F, size=9, italic=True, color=INK3)
    ndias = (dt.date(2026, mes % 12 + 1, 1) - dt.timedelta(days=1)).day

    # sem coluna de ausências (pedido do Marcos, 28/08/26): quem está fora
    # já se percebe pela própria matriz do mês — aqui é só quem trabalha
    colunas = [("Dia", 5), ("", 5), ("Manhã", 24), ("Tarde", 24), ("Noite", 24),
               ("Cobertura", 13)]
    chave_cal = {"Cobertura": "cobertura-cal"}
    for i, (h, w) in enumerate(colunas, start=1):
        c = ws.cell(row=3, column=i, value=h)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        c.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(i)].width = w
        if h in chave_cal:
            _tip(c, chave_cal[h])

    nomes_rng = f"{nome_mes}!$A${R_P0}:$A${R_P0+65}"

    def formula_turno(col, letras):
        rng = f"{nome_mes}!{col}${R_P0}:{col}${R_P0+65}"
        cond = "+".join(f'({rng}="{l}")' for l in letras)
        return (f'=IFERROR(TEXTJOIN(CHAR(10),TRUE,'
                f'FILTER({nomes_rng},({cond})>0)),"—")')

    # a semana inteira, de segunda a domingo, nas duas pontas (Marcos, 28/08):
    # o calendário abre na segunda da semana do dia 1º (vésperas) e fecha no
    # domingo da última semana (virada) — mesmas colunas vivas da aba do mês
    offset = dt.date(2026, mes, 1).weekday()
    n_virada = (7 - ((offset + ndias) % 7)) % 7
    dias = []
    if mes > 1:
        for j in range(offset):
            data = dt.date(2026, mes, 1) - dt.timedelta(days=offset - j)
            dias.append((data, C_D1 - offset + j, True))
    dias += [(dt.date(2026, mes, d + 1), C_D1 + d, False) for d in range(ndias)]
    if mes < 12:
        prox1 = dt.date(2026, mes % 12 + 1, 1)
        for j in range(n_virada):
            dias.append((prox1 + dt.timedelta(days=j), C_D32 + j, True))

    r = 3
    for data, col_n, vizinho in dias:
        r += 1
        fds = data.weekday() >= 5
        info_fer = D.FERIADOS_2026.get((data.month, data.day))
        cd = ws.cell(row=r, column=1,
                     value=data.strftime("%d/%m") if vizinho else data.day)
        cd.font = Font(name=F, bold=not vizinho, size=8 if vizinho else 11,
                       color="FFFFFF" if info_fer else (INK3 if vizinho else INK))
        cd.alignment = Alignment(horizontal="center", vertical="top")
        rotulo = info_fer[1] if info_fer else WD_PT[data.weekday()]
        cw = ws.cell(row=r, column=2, value=rotulo)
        cw.font = Font(name=F, size=9, bold=bool(info_fer),
                       color="FFFFFF" if info_fer else (CORALI if fds else INK3))
        cw.alignment = Alignment(horizontal="center", vertical="top")
        if info_fer:
            cd.fill = PatternFill("solid", fgColor=CORAL)
            cw.fill = PatternFill("solid", fgColor=CORALI)
        elif fds:
            for cc in (cd, cw):
                cc.fill = PatternFill("solid", fgColor=LAVS)
        col = get_column_letter(col_n)
        for j, letras in ((3, ("M", "D", "C", "J")), (4, ("T", "D", "C")),
                          (5, ("N", "NT"))):
            cel = ws.cell(row=r, column=j, value=formula_turno(col, letras))
            cel.font = Font(name=F, size=8, color=INK3 if vizinho else INK,
                            italic=vizinho)
            cel.alignment = Alignment(wrap_text=True, vertical="top")
            cel.border = BOX
            if vizinho or fds or info_fer:
                cel.fill = PatternFill("solid", fgColor=CREME2)
        # "M18 T12 N9 ✓" — sem denominador enganoso: quando sobra gente, o
        # x/(x+falta) da versão anterior mostrava "18/18" como se o alvo fosse 18
        f_falta = (f'{nome_mes}!{col}${R_P0+70}+{nome_mes}!{col}${R_P0+71}'
                   f'+{nome_mes}!{col}${R_P0+72}')
        cov = ws.cell(row=r, column=6, value=(
            f'="M"&{nome_mes}!{col}${R_P0+67}&" T"&{nome_mes}!{col}${R_P0+68}'
            f'&" N"&{nome_mes}!{col}${R_P0+69}'
            f'&IF({f_falta}=0," ✓"," ⚠ falta "&({f_falta}))'))
        cov.font = Font(name=F, size=8, color=INK3 if vizinho else INK2,
                        italic=vizinho)
        cov.alignment = Alignment(wrap_text=True, vertical="top")
        cov.border = BOX
        ws.row_dimensions[r].height = 110 if vizinho else 150
    creme(ws, r + 2, 7)
    ws.freeze_panes = "C4"
    return ws


def aba_esboco(wb, r_cota):
    """Outubro segundo o ESBOÇO da escalista — transcrição do PDF, para conferência.

    32 colunas (01/10 a 01/11). Contagens por fórmula; mínimos do dia escritos
    numa linha própria e a falta em vermelho, como nas mensais.
    """
    import esboco_out_dados as EB
    ws = wb.create_sheet("OUT · ESBOÇO", wb.sheetnames.index("OUT · DIA A DIA") + 1)
    ws.sheet_properties.tabColor = "D9A85A"
    ws.sheet_view.showGridLines = False
    t = ws.cell(row=1, column=1, value="Outubro · Esboço da escalista (verificação)")
    t.font = Font(name=DISPLAY, bold=True, size=14, color=INK)
    sub = ws.cell(row=1, column=9, value=(
        "Transcrito do PDF de 23/08 — 01/10 a 01/11. Compare com a aba OUT; a linha "
        "Falta mostra onde o esboço não bate o mínimo."))
    sub.font = Font(name=F, size=8, italic=True, color=INK3)
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 5
    NDIAS = 32
    pessoas = [(a2, ch) for a2, _n, ch, *_ in D.ROSTER]
    # vésperas de setembro fecham a 1ª semana civil — fórmulas vivas da aba SET
    offset = dt.date(2026, 10, 1).weekday()
    for j in range(N_PRE):
        col = C_PRE1 + j
        usada = j >= N_PRE - offset
        for rr in (4, 5, 6):
            ws.cell(row=rr, column=col, value=0)
        if not usada:
            ws.column_dimensions[get_column_letter(col)].width = 2.5
            for rr in (2, 3):
                ws.cell(row=rr, column=col).fill = PatternFill("solid", fgColor=LINE)
            continue
        ws.column_dimensions[get_column_letter(col)].width = 4.2
        d_prev = dt.date(2026, 10, 1) - dt.timedelta(days=N_PRE - j)
        cd = ws.cell(row=2, column=col, value=d_prev.strftime("%d/%m"))
        cd.font = Font(name=F, bold=True, size=7, color=INK2)
        cd.alignment = Alignment(horizontal="center")
        cd.fill = PatternFill("solid", fgColor=LAVS if d_prev.weekday() >= 5 else CREME2)
        cw = ws.cell(row=3, column=col, value=WD_PT[d_prev.weekday()])
        cw.font = Font(name=F, size=8, color=CORALI if d_prev.weekday() >= 5 else INK3)
        cw.alignment = Alignment(horizontal="center")
        _tip(cd, "dia-anterior")
    for i in range(NDIAS):
        col = C_D1 + i
        data = dt.date(2026, 11, 1) if i == 31 else dt.date(2026, 10, i + 1)
        letra_c = get_column_letter(col)
        ws.column_dimensions[letra_c].width = 4.2
        cd = ws.cell(row=2, column=col, value="01/11" if i == 31 else i + 1)
        cd.font = Font(name=F, bold=True, size=8 if i == 31 else 9,
                       color="FFFFFF" if (10, i + 1) in D.FERIADOS_2026 else INK)
        cd.alignment = Alignment(horizontal="center")
        cw = ws.cell(row=3, column=col, value=WD_PT[data.weekday()])
        cw.font = Font(name=F, size=8,
                       color=CORALI if data.weekday() >= 5 else INK3)
        cw.alignment = Alignment(horizontal="center")
        if (10, i + 1) in D.FERIADOS_2026:
            cd.fill = PatternFill("solid", fgColor=CORAL)
            cw.value = D.FERIADOS_2026[(10, i + 1)][1]
            cw.font = Font(name=F, size=8, bold=True, color="FFFFFF")
            cw.fill = PatternFill("solid", fgColor=CORALI)
        elif data.weekday() >= 5:
            cd.fill = PatternFill("solid", fgColor=LAVS)
        fora = i == 31                     # 01/11 conta na cota de novembro
        ws.cell(row=4, column=col, value=0 if fora else (1 if data.weekday() >= 5 else 0))
        ws.cell(row=5, column=col, value=0 if fora else (1 if data.weekday() == 4 else 0))
        ws.cell(row=6, column=col, value=0 if fora else (1 if (10, i + 1) in D.FERIADOS_2026 else 0))
    for rr, rot in ((4, "máscara fds"), (5, "máscara sexta"), (6, "máscara feriado")):
        ws.row_dimensions[rr].hidden = True
        ws.cell(row=rr, column=1, value=rot)
    for col, txt in ((C_MED, "Médico"), (C_CH, "CH")):
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
    # calculadoras — as mesmas 11 da aba original, adaptadas às 32 colunas
    E_D1, E_DN = C_D1, C_D1 + NDIAS - 1                     # C .. AH (exibição)
    # calculadoras param no dia 31: o 01/11 conta na cota de novembro (doc §6)
    E_CALC = E_DN - 1                                        # AG
    L1, LN = get_column_letter(E_D1), get_column_letter(E_CALC)
    LN_1, L2 = get_column_letter(E_CALC - 1), get_column_letter(E_D1 + 1)
    E_TOT = E_DN + 1
    for i, txt in enumerate(COLS_TOT):
        col = E_TOT + i
        c = _tip(ws.cell(row=R_HDR, column=col, value=txt),
                 "sem-n" if txt.startswith("Sem ") else
                 ("grupo-filtro" if txt == "Grupo" else
                  ("ordem-original" if txt == "Nº" else txt)))
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=CORALI if 6 <= i <= 10 else LAVI)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = \
            7.5 if i <= 10 else (13 if txt == "Grupo" else (4.5 if txt == "Nº" else 6))
    semanas32 = round(31 / 7, 2)
    jans_eb = janelas_semana_civil(10, 31)
    for k, (apelido, ch) in enumerate(pessoas):
        lin = R_P0 + k
        ws.cell(row=lin, column=C_MED, value=apelido).font = Font(
            name=F, size=9, bold=True, color=INK)
        cc = ws.cell(row=lin, column=C_CH, value=ch)
        cc.font = Font(name=F, size=8, color=INK3)
        cc.alignment = Alignment(horizontal="center")
        for j in range(N_PRE):
            col = C_PRE1 + j
            c = ws.cell(row=lin, column=col)
            if j < N_PRE - offset:
                c.fill = PatternFill("solid", fgColor=LINE)
                continue
            d_prev = dt.date(2026, 10, 1) - dt.timedelta(days=N_PRE - j)
            ref = f"SET!{get_column_letter(C_D1 + d_prev.day - 1)}{lin}"
            c.value = f'=IF({ref}="","",{ref})'
            c.font = Font(name=F, size=9, color=INK2)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            c.fill = PatternFill("solid",
                                 fgColor=LAVS if d_prev.weekday() >= 5 else CREME2)
        for i in range(NDIAS):
            col = C_D1 + i
            letra = EB.ESBOCO.get(apelido, {}).get(i + 1)
            c = ws.cell(row=lin, column=col)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            if letra:
                c.value = letra
                c.font = Font(name=F, size=9, bold=True,
                              color="FFFFFF" if letra in BRANCO else INK)
                if letra in FILLS:
                    c.fill = PatternFill("solid", fgColor=FILLS[letra])
        eh = expr_horas(lin, E_D1, E_CALC)
        col_s1 = get_column_letter(E_TOT + 11)
        col_sf = get_column_letter(E_TOT + 10 + N_SEM)
        f = [f"=SUMPRODUCT({eh})",
             f"=SUMPRODUCT(${L1}$4:${LN}$4,{eh})",
             f'=SUMPRODUCT(${L1}$5:${LN}$5,(${L1}{lin}:${LN}{lin}="N")*1)',
             f"=SUMPRODUCT(${L1}$6:${LN}$6,{eh})",
             f"=ROUND({get_column_letter(C_CH)}{lin}*{semanas32},0)",
             f"={get_column_letter(E_TOT)}{lin}-{get_column_letter(E_TOT+4)}{lin}",
             f'=SUMPRODUCT((${L_PRE1}{lin}:${LN_1}{lin}="N")*'
             f'((${L_PRE2}{lin}:${LN}{lin}="M")+(${L_PRE2}{lin}:${LN}{lin}="E")'
             f'+(${L_PRE2}{lin}:${LN}{lin}="C")+(${L_PRE2}{lin}:${LN}{lin}="D")))',
             f'=SUMPRODUCT((${L_PRE1}{lin}:${LN_1}{lin}="N")*(${L_PRE2}{lin}:${LN}{lin}="T"))',
             f'=IFERROR(INDEX(CONFIG!$B${r_cota}:$D${r_cota+2},'
             f'MATCH(${get_column_letter(C_CH)}{lin},CONFIG!$A${r_cota}:$A${r_cota+2},0),'
             f'IF(COUNTIF(${L1}{lin}:${LN}{lin},"FE")>=10,1,'
             f'IF(COUNTIF(${L1}{lin}:${LN}{lin},"FE")>=1,2,3))),"")',
             f'=IF({get_column_letter(E_TOT+8)}{lin}="","",'
             f'MAX(0,{get_column_letter(E_TOT+1)}{lin}-'
             f'{get_column_letter(E_TOT+8)}{lin}*CONFIG!$E${r_cota}))',
             f"=MAX({col_s1}{lin}:{col_sf}{lin})"]
        f += ["=" + "+".join(f"SUMPRODUCT({expr_horas(lin, a2, b2)})"
                             for a2, b2 in spans) for spans in jans_eb]
        f += [""] * (N_SEM - len(jans_eb))
        for i, formula in enumerate(f):
            c = ws.cell(row=lin, column=E_TOT + i, value=formula or None)
            c.number_format = "0"
            c.font = Font(name=F, size=8, color=INK2 if (i < 5 or i > 10) else INK,
                          bold=(i == 5))
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
        cg = ws.cell(row=lin, column=E_TOT + IDX_GRUPO, value=grupo_filtro(apelido))
        cg.font = Font(name=F, size=8, color=INK3)
        cg.border = BOX
        cn = ws.cell(row=lin, column=E_TOT + IDX_NUM, value=k + 1)
        cn.font = Font(name=F, size=8, color=INK3)
        cn.alignment = Alignment(horizontal="center")
        cn.border = BOX
    col_exc = get_column_letter(E_TOT + 9)
    ws.conditional_formatting.add(
        f"{col_exc}{R_P0}:{col_exc}{R_P0+len(pessoas)-1}",
        CellIsRule(operator="greaterThan", formula=["0"],
                   fill=PatternFill("solid", bgColor=CORAL),
                   font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    ws.conditional_formatting.add(
        f"{get_column_letter(E_TOT + 10)}{R_P0}:"
        f"{get_column_letter(E_TOT + 10 + N_SEM)}{R_P0+len(pessoas)-1}",
        CellIsRule(operator="greaterThan", formula=["44"],
                   fill=PatternFill("solid", bgColor=CORAL),
                   font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    ultima = R_P0 + len(pessoas) - 1
    r = ultima + 2
    grupos = [(rot, [k2 for k2, v in D.TURNOS.items() if v[4 + gi]], gi)
              for gi, rot in enumerate(("Manhã", "Tarde", "Noite"))]
    for gi, (rot, letras, idx) in enumerate(grupos):
        rl, rf, rm = r + gi, r + 4 + gi, r + 3
        _tip(ws.cell(row=rl, column=C_MED, value=rot), "cob-turno")
        ws.cell(row=rl, column=C_MED).font = Font(name=F, size=9, bold=True, color=LAVI)
        ws.cell(row=rm, column=C_MED, value="Mínimo do dia").font = Font(
            name=F, size=8, color=INK3)
        cf0 = ws.cell(row=rf, column=C_MED, value=f"Falta {rot.lower()}")
        cf0.font = Font(name=F, size=9, bold=True, color=CORALI)
        _tip(cf0, "falta")
        for i in range(NDIAS):
            col = get_column_letter(C_D1 + i)
            data = dt.date(2026, 11, 1) if i == 31 else dt.date(2026, 10, i + 1)
            tipo = "útil" if data.weekday() < 5 else ("sábado" if data.weekday() == 5 else "domingo")
            minimo = D.MINIMOS[tipo][idx]
            faixa = f"{col}{R_P0}:{col}{ultima}"
            conta = "+".join(f'COUNTIF({faixa},"{x}")' for x in letras)
            c1 = ws.cell(row=rl, column=C_D1 + i, value=f"={conta}")
            c1.font = Font(name=F, size=8, color=INK2)
            c1.alignment = Alignment(horizontal="center")
            if gi == 0:
                cmin = ws.cell(row=rm, column=C_D1 + i,
                               value="/".join(str(D.MINIMOS[tipo][j]) for j in range(3)))
                cmin.font = Font(name=F, size=6.5, color=INK3)
                cmin.alignment = Alignment(horizontal="center")
            cf = ws.cell(row=rf, column=C_D1 + i, value=f"=MAX(0,{minimo}-{col}{r+gi})")
            cf.font = Font(name=F, size=8, bold=True, color=CORALI)
            cf.alignment = Alignment(horizontal="center")
    for rf in (r + 4, r + 5, r + 6):
        faixa = f"{get_column_letter(C_D1)}{rf}:{get_column_letter(C_D1+31)}{rf}"
        ws.conditional_formatting.add(faixa, CellIsRule(
            operator="greaterThan", formula=["0"],
            fill=PatternFill("solid", bgColor=CORAL),
            font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    creme(ws, r + 8, C_D1 + NDIAS + len(COLS_TOT) + 1)
    ws.freeze_panes = f"{L_PRE1}{R_P0}"
    return ws


def contagem_oficial_sxn():
    """lê a aba SEXTA NOITE da contagem anual da Mari: {(apelido, mês): nº}."""
    import unicodedata
    caminho = os.path.join(senior_import.DIR_FONTES,
                           "CONTAGEM FDS - SEXTA NOITE - FERIADO 2026"
                           "(Recuperado Automaticamente).xlsx")
    if not os.path.exists(caminho):
        return {}
    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb["SEXTA NOITE"]
    alias = {"Mpinheiro": "MPinheiro", "Letícia": "Leticia", "PJamile": "Pjamile",
             "Raquel Assis": "Raquel", "Marilia": "Marilia"}
    colunas = {}
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=1, column=c).value
        if isinstance(v, str):
            up = unicodedata.normalize("NFC", v.strip()).upper()
            if up in senior_import.MESES:
                colunas[senior_import.MESES[up]] = c
    saida = {}
    for r in range(2, ws.max_row + 1):
        nome = ws.cell(row=r, column=2).value
        if not nome or not str(nome).strip():
            continue
        nome = unicodedata.normalize("NFC", str(nome).strip())
        nome = alias.get(nome, nome)
        for m, c in colunas.items():
            v = ws.cell(row=r, column=c).value
            if isinstance(v, (int, float)):
                saida[(nome, m)] = saida.get((nome, m), 0) + int(v)
    return saida


def aba_validador(wb, DIAS, pessoas):
    ws = wb.create_sheet("VALIDADOR")
    ws.sheet_properties.tabColor = CORALI
    estilo_titulo(ws, "Validador · O que fere regra dura",
                  "Estrutural = a forma do contrato · Pontual = erro daquele mês")
    for col, w in zip("ABCDEF", (15, 13, 13, 62, 17, 30)):
        ws.column_dimensions[col].width = w

    grupo_de = {a: g for a, _n, _c, g, *_ in D.ROSTER}
    achados = auditar(DIAS, [p for p, _ in pessoas])
    from collections import Counter
    dsr_por_pessoa = Counter(a["pessoa"] for a in achados if a["tipo"] == "DSR")

    estrutural, alerta, registro = [], [], []
    for a in achados:
        if a["tipo"] == "DSR":
            if grupo_de.get(a["pessoa"]) in ("chefia", "rotina", "administrativo") \
                    or dsr_por_pessoa[a["pessoa"]] >= 3:
                estrutural.append(a)
            else:
                alerta.append(a)
        elif a["horas"] <= 2:
            alerta.append(a)
        else:
            registro.append(a)

    r = 3

    def secao(titulo, cor, explicacao):
        nonlocal r
        c = ws.cell(row=r, column=1, value=titulo)
        c.font = Font(name=DISPLAY, bold=True, size=12, color=cor)
        r += 1
        e = ws.cell(row=r, column=1, value=explicacao)
        e.font = Font(name=F, size=9, italic=True, color=INK2)
        e.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        ws.row_dimensions[r].height = 28
        r += 2

    def cabecalho():
        nonlocal r
        for i, h in enumerate(("Médico", "Grupo", "Quando", "O que acontece",
                               "Base", "Tratamento"), start=1):
            c = ws.cell(row=r, column=i, value=h)
            c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor=LAVI)
        r += 1

    def despejar(itens, trat, cor):
        nonlocal r
        for a in itens:
            ws.cell(row=r, column=1, value=a["pessoa"]).font = Font(
                name=F, size=9, bold=True, color=INK)
            ws.cell(row=r, column=2, value=grupo_de.get(a["pessoa"], "—")).font = Font(
                name=F, size=8, color=INK3)
            ws.cell(row=r, column=3, value=f'{a["data"]:%d/%m}').font = Font(
                name=F, size=8, color=INK2)
            cd = ws.cell(row=r, column=4, value=a["detalhe"])
            cd.font = Font(name=F, size=9, color=INK)
            cd.alignment = Alignment(wrap_text=True, vertical="top")
            ws.cell(row=r, column=5, value=a["regra"]).font = Font(
                name=F, size=8, color=INK3)
            ct = ws.cell(row=r, column=6, value=trat)
            ct.font = Font(name=F, size=8, bold=True, color=cor)
            for i in range(1, 7):
                ws.cell(row=r, column=i).border = BOX
            r += 1

    secao("ESTRUTURAL — decisão de política, não erro de montagem", LAVI,
          "Quem faz 6h de manhã todos os dias tem folga de 18h entre turnos (13h → 07h) e "
          "nunca alcança as 24h consecutivas do art. 67. Não é descuido da escala: é a forma "
          "do contrato de diarista. Aparece aqui uma vez por semana afetada, pra ficar "
          "visível sem virar alarme. Resolver isso é decisão da chefia, não da escalista.")
    cabecalho()
    por_pessoa = {}
    for a in estrutural:
        por_pessoa.setdefault(a["pessoa"], []).append(a)
    for pessoa, itens in sorted(por_pessoa.items(), key=lambda x: -len(x[1])):
        ws.cell(row=r, column=1, value=pessoa).font = Font(name=F, size=9, bold=True, color=INK)
        ws.cell(row=r, column=2, value=grupo_de.get(pessoa, "—")).font = Font(
            name=F, size=8, color=INK3)
        ws.cell(row=r, column=3, value=f"{len(itens)} semanas").font = Font(
            name=F, size=8, color=INK2)
        cd = ws.cell(row=r, column=4, value="sem folga de 24h consecutivas nessas semanas: "
                     + ", ".join(f'{a["data"]:%d/%m}' for a in itens))
        cd.font = Font(name=F, size=9, color=INK)
        cd.alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=5, value="art. 67 CLT").font = Font(name=F, size=8, color=INK3)
        ws.cell(row=r, column=6, value="ESTRUTURAL").font = Font(
            name=F, size=8, bold=True, color=LAVI)
        for i in range(1, 7):
            ws.cell(row=r, column=i).border = BOX
        ws.row_dimensions[r].height = 24
        r += 1
    r += 2

    secao(f"ALERTA — pontual, o alvo é zero ({len(alerta)})", CORALI,
          "Descanso de 2h ou menos entre jornadas: na prática é jornada de 18h emendada. "
          "Era ~15 casos por mês no 1º trimestre de 2026 e caiu pra ~2 depois da mudança de "
          "abril — a regra apertou e funcionou. O papel desta aba é segurar a linha no zero. "
          "Nas abas mensais isto é a coluna 18h⚠, que recalcula sozinha ao digitar.")
    cabecalho()
    despejar(alerta, "ALERTA", CORALI)
    r += 2

    secao(f"REGISTRO — prática estabelecida do serviço ({len(registro)})", INK2,
          "Noite 19–07h seguida da tarde 13–19h: 18h de trabalho com 6h de pausa. São 90 "
          "casos em 6 meses, 26 pessoas, sem queda no ano — é como o serviço funciona, não "
          "acidente. Decisão de 17/08/26: continua e fica registrado, sem alarme. Fica aqui "
          "porque está abaixo das 11h do art. 66 e, se algum dia for questionado, o registro "
          "existe. Observação honesta: o arquivo de códigos não carrega BHP/BHN nem troca, "
          "então parte destes casos pode ser troca documentada.")
    cabecalho()
    despejar(registro, "REGISTRO", INK2)
    r += 2

    # adicional noturno
    c = ws.cell(row=r, column=1, value="ADICIONAL NOTURNO — horas em 22h–05h, por pessoa e mês")
    c.font = Font(name=DISPLAY, bold=True, size=12, color=LAVI)
    r += 1
    e = ws.cell(row=r, column=1, value="Insumo da folha: a hora noturna vale 52min30s e o "
                "adicional é de no mínimo 20% (art. 73 CLT). A noite de 19–07h cai inteira "
                "dentro da janela nas 7 horas entre 22h e 05h.")
    e.font = Font(name=F, size=9, italic=True, color=INK2)
    e.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    ws.row_dimensions[r].height = 24
    r += 2
    noturnas = noturnas_por_mes(DIAS, [p for p, _ in pessoas])
    ws.cell(row=r, column=1, value="Médico").font = Font(name=F, bold=True, size=8, color="FFFFFF")
    ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor=LAVI)
    for i, m in enumerate(MESES_PT):
        cc = ws.cell(row=r, column=2 + i, value=m)
        cc.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        cc.fill = PatternFill("solid", fgColor=LAVI)
        cc.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(2 + i)].width = 6
    ws.cell(row=r, column=14, value="Ano").font = Font(name=F, bold=True, size=8, color="FFFFFF")
    ws.cell(row=r, column=14).fill = PatternFill("solid", fgColor=CORALI)
    r += 1
    for pessoa, _ch in pessoas:
        total = 0
        tem = False
        ws.cell(row=r, column=1, value=pessoa).font = Font(name=F, size=9, bold=True, color=INK)
        for i, m in enumerate(range(1, 13)):
            v = noturnas.get((pessoa, m))
            if v:
                tem = True
                total += v
                cc = ws.cell(row=r, column=2 + i, value=round(v, 1))
                cc.font = Font(name=F, size=8, color=INK2)
                cc.alignment = Alignment(horizontal="center")
        ct = ws.cell(row=r, column=14, value=round(total, 1) if total else None)
        ct.font = Font(name=F, size=8, bold=True, color=INK)
        ct.alignment = Alignment(horizontal="center")
        if tem:
            r += 1
        else:
            for i in range(1, 15):
                ws.cell(row=r, column=i).value = None
    creme(ws, r + 2, 14)
    ws.freeze_panes = "A4"
    return ws


def abas_mes_vivo(wb, ns, mov=None):
    atend = _atend_do_v3()
    ws = wb.create_sheet("ATENDIMENTO")
    ws.sheet_properties.tabColor = PINK
    estilo_titulo(ws, "Atendimento e justificativas · Outubro de 2026")
    sub = ws.cell(row=2, column=1, value="Cobertura 100% nos 31 dias · convocações na aba "
                  "ao lado · critério público, sem favoritismo")
    sub.font = Font(name=F, size=10, italic=True, color=INK2)
    for j, (h, w) in enumerate(zip(["Quem / o quê", "Status",
                                    "Justificativa (critério público)"],
                                   [22, 16, 120]), start=1):
        c = ws.cell(row=4, column=j, value=h)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        ws.column_dimensions[get_column_letter(j)].width = w
    for i, (quem, st, txt) in enumerate(atend, start=5):
        ws.cell(row=i, column=1, value=quem).font = Font(name=F, bold=True, size=10, color=INK)
        s = ws.cell(row=i, column=2, value=st)
        s.font = Font(name=F, bold=True, size=9,
                      color=("5A6E50" if st.startswith("✓") else CORALI))
        t = ws.cell(row=i, column=3, value=txt)
        t.font = Font(name=F, size=9, color=INK)
        t.alignment = Alignment(wrap_text=True, vertical="top")
        for j in (1, 2, 3):
            ws.cell(row=i, column=j).border = BOX
    creme(ws, len(atend) + 8, 3)
    ws.freeze_panes = "A5"

    ws2 = wb.create_sheet("CONVOCAÇÕES")
    ws2.sheet_properties.tabColor = CORALI
    estilo_titulo(ws2, "Convocações · Outubro de 2026")
    novas = (mov or {}).get("novas", [])
    convoc = [(ap, d, t) for ap, d, t, _fase in novas]
    fase_de = {(ap, d, t): fase for ap, d, t, fase in novas}
    nconv = {}
    for ap, _d, _s in convoc:
        nconv[ap] = nconv.get(ap, 0) + 1
    import ajustes_out as AJ
    exp = ws2.cell(row=2, column=1, value=(
        f"{len(convoc)} convocações da remontagem de 18/08, sob as regras novas (rotina só "
        "manhã em dia útil e nunca FDS · teto de 44h/semana · compromissos de setembro). "
        "Critério público: entra primeiro quem está mais abaixo do próprio alvo. Impedimento "
        "com motivo declarado é intocável. Toda convocação gera CRÉDITO no mês seguinte."))
    exp.font = Font(name=F, size=10, color=INK2)
    exp.alignment = Alignment(wrap_text=True, vertical="top")
    # 3 linhas de altura de verdade: o merge de 2 linhas cortava o texto no meio
    ws2.merge_cells(start_row=2, start_column=1, end_row=4, end_column=5)
    for rr in (2, 3, 4):
        ws2.row_dimensions[rr].height = 17
    for j, (h, w) in enumerate(zip(["Médico", "Convocações", "Dias", "Crédito em novembro"],
                                   [16, 12, 46, 22]), start=1):
        c = ws2.cell(row=5, column=j, value=h)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        ws2.column_dimensions[get_column_letter(j)].width = w
    r = 6
    wd = ns["wd"]
    for ap, n in sorted(nconv.items(), key=lambda x: (-x[1], x[0])):
        dias_txt = " · ".join(
            f"{d:02d}/{WD_PT[wd(d)]} {s}"
            + (" (set)" if fase_de.get((a2, d, s)) == "compromisso de setembro" else "")
            for a2, d, s in sorted(convoc, key=lambda x: x[1])
            if a2 == ap)
        ws2.cell(row=r, column=1, value=ap).font = Font(name=F, size=9, bold=True, color=INK)
        cn = ws2.cell(row=r, column=2, value=n)
        cn.font = Font(name=F, size=10, bold=True, color=CORALI if n >= 3 else INK2)
        cn.alignment = Alignment(horizontal="center")
        cd = ws2.cell(row=r, column=3, value=dias_txt)
        cd.font = Font(name=F, size=8, color=INK2)
        cd.alignment = Alignment(wrap_text=True, vertical="top")
        cc = ws2.cell(row=r, column=4, value="prioridade nas preferências")
        cc.font = Font(name=F, size=8, color="5A6E50")
        for j in range(1, 5):
            ws2.cell(row=r, column=j).border = BOX
        r += 1
    # ajustes do feriado, com o motivo colado em cada linha
    import ajustes_out
    r += 1
    ws2.cell(row=r, column=1, value="Ajustes do feriado 12/10").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    r += 1
    for apelido, dia, letra, motivo in ajustes_out.AJUSTES:
        ws2.cell(row=r, column=1, value=apelido).font = Font(
            name=F, size=9, bold=True, color=INK)
        cl = ws2.cell(row=r, column=2, value=f"{dia:02d}/10 {letra}")
        cl.font = Font(name=F, size=9, bold=True, color=CORALI)
        cl.alignment = Alignment(horizontal="center")
        cm2 = ws2.cell(row=r, column=3, value=motivo)
        cm2.font = Font(name=F, size=8, color=INK2)
        cm2.alignment = Alignment(wrap_text=True, vertical="top")
        ws2.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        for j in range(1, 5):
            ws2.cell(row=r, column=j).border = BOX
        ws2.row_dimensions[r].height = 26
        r += 1
    r += 1
    ws2.cell(row=r, column=1, value="Quem da rotina folga o feriado, e por quê").font = Font(
        name=DISPLAY, bold=True, size=11, color=LAVI)
    r += 1
    for apelido, motivo in ajustes_out.FOLGAS:
        ws2.cell(row=r, column=1, value=apelido).font = Font(
            name=F, size=9, bold=True, color=INK)
        cf2 = ws2.cell(row=r, column=3, value=motivo)
        cf2.font = Font(name=F, size=8, color=INK2)
        cf2.alignment = Alignment(wrap_text=True, vertical="top")
        ws2.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        for j in range(1, 5):
            ws2.cell(row=r, column=j).border = BOX
        ws2.row_dimensions[r].height = 26
        r += 1
    r += 1
    ws2.cell(row=r, column=1, value="Registro das decisões").font = Font(
        name=DISPLAY, bold=True, size=11, color=CORALI)
    r += 1
    for tema, status, texto in ajustes_out.NAO_FEITO:
        ws2.cell(row=r, column=1, value=tema).font = Font(
            name=F, size=9, bold=True, color=INK)
        cs = ws2.cell(row=r, column=2, value=status)
        cs.font = Font(name=F, size=8, bold=True, color=CORALI)
        cs.alignment = Alignment(wrap_text=True, vertical="top", horizontal="center")
        ct2 = ws2.cell(row=r, column=3, value=texto)
        ct2.font = Font(name=F, size=8, color=INK2)
        ct2.alignment = Alignment(wrap_text=True, vertical="top")
        ws2.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        for j in range(1, 5):
            ws2.cell(row=r, column=j).border = BOX
        ws2.row_dimensions[r].height = 58
        r += 1
    creme(ws2, r + 2, 5)
    ws2.freeze_panes = "A6"


def main():
    DIAS, rel_grade, ns = carregar_dados()
    oficial = contagem_oficial_sxn()
    pessoas = [(a, ch) for a, _n, ch, *_ in D.ROSTER]

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    aba_leiame(wb, rel_grade)
    aba_cadastro(wb)
    _cfg, fim_cod, r_cota = aba_config(wb)
    for mes in range(1, 13):
        aba_mes(wb, mes, DIAS, fim_cod, pessoas, r_cota)
    aba_dia_a_dia(wb, mes=10)
    aba_esboco(wb, r_cota)
    aba_painel(wb, pessoas, oficial)
    aba_senior(wb, pessoas, fim_cod)
    aba_validador(wb, DIAS, pessoas)
    abas_mes_vivo(wb, ns, ns.get("_mov"))
    # painel de leitura: DADOS DASH alimenta os gráficos, DASHBOARD é a capa
    import v4_dashboard as VD
    VD.aba_dados(wb)
    VD.aba_dashboard(wb, mes_vivo="OUT", nome_mes="outubro")

    destino = os.path.join(AQUI, "Escala UTI HCB 2026 - unificada v4.xlsx")
    wb.save(destino)
    tam = os.path.getsize(destino) / 1024
    print(f"\n=== planilha v4 salva ===\n{destino}\n{tam:.0f} kb · {len(wb.sheetnames)} abas")
    print("abas:", " · ".join(wb.sheetnames))
    return destino


if __name__ == "__main__":
    main()
