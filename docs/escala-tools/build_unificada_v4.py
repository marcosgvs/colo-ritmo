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
LINE, CREME = "EBE8E5", "FFFAF3"
LAV, LAVI, LAVS = "A299CB", "5A4E8C", "ECEAF4"
AQUA, AQUAS = "9AD8E1", "E8F6F8"
SAND, SANDS = "E8C79A", "FBF1E1"
CORAL, CORALI, CORALS = "E7A59C", "C77264", "FBE9E5"
SAGE, SAGES = "A4D498", "ECF6E7"
BLUES, PINK, OLIVES = "EAF2F9", "E79BC4", "F1EFE0"
F = "Helvetica Neue"

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
C_D1 = 3                      # primeira coluna de dia (C)
C_DN = C_D1 + 30              # última (AG) — sempre 31 colunas, geometria fixa
COLS_TOT = ["CH mês", "fds", "SxN", "feriado", "meta", "saldo", "18h⚠", "N→T"]
C_TOT = C_DN + 1              # AH..AO
R_TIT, R_DIA, R_DOW, R_FDS, R_SEX, R_FER, R_HDR, R_P0 = 1, 2, 3, 4, 5, 6, 7, 8

L_D1, L_DN = get_column_letter(C_D1), get_column_letter(C_DN)
L_DN_1 = get_column_letter(C_DN - 1)
L_D2 = get_column_letter(C_D1 + 1)

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
    ns = runpy.run_path(os.path.join(AQUI, "escala_out_v3.py"))
    for apelido, por_dia in ns["PLAN"].items():
        for dia, letra in por_dia.items():
            data = dt.date(2026, 10, dia)
            DIAS.setdefault(data, {})[apelido] = (letra, "montado")
    return DIAS, rel_grade, ns


# ============================================================== abas
def estilo_titulo(ws, texto, sub=""):
    c = ws.cell(row=1, column=1, value=texto)
    c.font = Font(name=F, bold=True, size=15, color=LAVI)
    if sub:
        s = ws.cell(row=1, column=4, value=sub)
        s.font = Font(name=F, size=9, color=INK3)
    ws.sheet_view.showGridLines = False


def aba_leiame(wb, rel_grade):
    ws = wb.create_sheet("LEIA-ME")
    ws.sheet_properties.tabColor = PINK
    estilo_titulo(ws, "escala UTI HCB · 2026 — planilha unificada v4")
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 30
    for col in "CDEFGH":
        ws.column_dimensions[col].width = 17
    r = 3

    def secao(titulo):
        nonlocal r
        c = ws.cell(row=r, column=1, value=titulo)
        c.font = Font(name=F, bold=True, size=11, color=LAVI)
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

    secao("o que é")
    linha("", "O ano inteiro num arquivo: 12 abas mensais com a escala real, o painel "
              "comparativo do ano, a tradução pros códigos do Senior e o validador das "
              "regras que são lei. Tudo o que é contagem é fórmula — digitou o código na "
              "aba do mês, a cobertura, a carga horária, o saldo e os alertas se refazem sozinhos.")
    r += 1
    secao("legenda dos códigos")
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
    linha("antigos", "Até abril de 2026 os códigos eram outros: "
          + " · ".join(f"{k} = {v}" for k, v in D.CODIGOS_ANTIGOS.items())
          + ". A mudança de abril passou a usar 2/40/41.")
    r += 1

    secao("as abas")
    for nome, desc in (
        ("CADASTRO", "quem é quem: carga horária, restrições duras, sexta-noite e fds extra. "
                     "É a fonte dos nomes de todas as abas mensais."),
        ("CONFIG", "as regras como dado: cobertura mínima, cota de fds em mês com férias, "
                   "tabela de códigos e as regras duras com o artigo da CLF. Mudou aqui, "
                   "mudou na planilha toda."),
        ("JAN a DEZ", "a escala: matriz médico × dia. No rodapé, a lotação de cada turno em "
                      "cada dia e quanto falta pro mínimo. À direita, por pessoa: carga do mês, "
                      "fds, sexta-noite, feriado, meta, saldo e os dois alertas de jornada."),
        ("PAINEL ANO", "o comparativo do ano: saldo, fds, sexta-noite e feriado de cada pessoa "
                       "mês a mês, com acumulado. Onde existe a contagem manual antiga, ela "
                       "aparece ao lado pra conferência."),
        ("SENIOR", "escolha o mês em B1 e a matriz inteira sai traduzida nos códigos do RH, "
                   "pronta pra lançar."),
        ("VALIDADOR", "o que fere regra dura, separado em ESTRUTURAL (é a forma do contrato, "
                      "decisão de política) e PONTUAL (erro daquele mês)."),
        ("ATENDIMENTO / CONVOCAÇÕES", "o mês vivo: o que foi atendido de cada pedido e por quê, "
                                      "e quem foi convocado fora da preferência, com o critério público."),
    ):
        linha(nome, desc, negrito=True)
    r += 1

    secao("de onde vem cada mês — leia antes de comparar")
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
    secao("o que ainda falta")
    for falta in (
        "Maio dia 3 não existe em nenhum arquivo recebido — a coluna fica vazia.",
        "Janeiro começa no dia 2: a grade recebida não tem o dia 1º.",
        "Junho e janeiro não têm arquivo de códigos Senior; foram reconstruídos da grade.",
        "Novembro e dezembro estão em branco, prontos pra montar.",
        "Dois códigos órfãos no histórico: 23 (Isabella 23/08) e 3 (Laura 02/08) — não "
        "constam em nenhuma legenda; ficaram de fora.",
        "A coluna 18h⚠ compara cada dia com o seguinte DENTRO do mês. Uma noite no último "
        "dia do mês emendando a manhã do dia 1º do mês seguinte não é pega pela coluna — "
        "a aba VALIDADOR pega, porque olha o ano inteiro sem parar na virada.",
        "O seletor de mês da aba SENIOR usa INDIRECT, que só resolve com o arquivo aberto "
        "no Excel ou no Google Sheets — em pré-visualização de e-mail ou no Drive sem abrir, "
        "a matriz aparece vazia. Abrir e escolher o mês em B1 resolve.",
    ):
        linha("·", falta)
    return ws


def aba_cadastro(wb):
    ws = wb.create_sheet("CADASTRO")
    ws.sheet_properties.tabColor = AQUA
    estilo_titulo(ws, "cadastro · quem é quem",
                  f"{len(D.ROSTER)} pessoas ativas")
    cabecalhos = ["médico", "nome completo", "CH", "grupo", "restrições duras",
                  "sexta-noite", "fds extra", "observações"]
    larguras = [14, 22, 5, 15, 58, 16, 14, 52]
    for i, (h, w) in enumerate(zip(cabecalhos, larguras), start=1):
        cel = ws.cell(row=3, column=i, value=h)
        cel.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        cel.fill = PatternFill("solid", fgColor=LAVI)
        cel.alignment = Alignment(horizontal="left", vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = w
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
        ws.row_dimensions[r].height = 26
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="fora do roster").font = Font(name=F, bold=True, size=10, color=CORALI)
    r += 1
    for apelido, motivo in D.FORA_DO_ROSTER:
        ws.cell(row=r, column=1, value=apelido).font = Font(name=F, size=9, bold=True, color=INK3)
        ws.cell(row=r, column=2, value=motivo).font = Font(name=F, size=9, color=INK3)
        r += 1
    ws.freeze_panes = "C4"
    return ws


def aba_config(wb):
    ws = wb.create_sheet("CONFIG")
    ws.sheet_properties.tabColor = SAGE
    estilo_titulo(ws, "config · as regras como dado",
                  "mudou aqui, muda na planilha toda")
    for col, w in zip("ABCDEFG", (18, 13, 13, 13, 13, 44, 44)):
        ws.column_dimensions[col].width = w

    def cab(r, textos):
        for i, t in enumerate(textos, start=1):
            cel = ws.cell(row=r, column=i, value=t)
            cel.font = Font(name=F, bold=True, size=9, color="FFFFFF")
            cel.fill = PatternFill("solid", fgColor=LAVI)

    # cobertura mínima — linhas 4,5,6 são referenciadas pelas abas mensais
    ws.cell(row=3, column=1, value="cobertura mínima por turno").font = Font(
        name=F, bold=True, size=11, color=LAVI)
    cab(3, ["cobertura mínima", "manhã", "tarde", "noite"])
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
    ws.merge_cells(start_row=4, start_column=6, end_row=6, end_column=7)

    # tabela de códigos — linhas 9..20, referenciada pela aba SENIOR
    ws.cell(row=8, column=1, value="tabela de códigos").font = Font(name=F, bold=True, size=11, color=LAVI)
    cab(9, ["letra", "Senior", "horas", "conta manhã", "conta tarde", "conta noite", "turno"])
    r = 10
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
    ws.cell(row=r, column=1, value="cota de fds em mês com férias").font = Font(
        name=F, bold=True, size=11, color=LAVI)
    r += 1
    cab(r, ["CH semanal", "férias 2 sem", "férias 1 sem", "sem férias"])
    r += 1
    for ch, duas, uma, sem in D.COTA_FDS_FERIAS:
        for j, v in enumerate((ch, duas, uma, sem)):
            cel = ws.cell(row=r, column=1 + j, value=v)
            cel.font = Font(name=F, size=10, color=INK, bold=(j == 0))
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
        r += 1

    # feriados do ano — eram dado escondido no Python; agora vivem aqui
    r += 1
    ws.cell(row=r, column=1, value="feriados de 2026").font = Font(
        name=F, bold=True, size=11, color=LAVI)
    nf = ws.cell(row=r, column=5, value=D.NOTA_FERIADOS)
    nf.font = Font(name=F, size=9, color=INK2)
    nf.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=5, end_row=r + 5, end_column=7)
    r += 1
    cab(r, ["data", "sigla", "feriado"])
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
    ws.cell(row=r, column=1, value="regras duras").font = Font(name=F, bold=True, size=11, color=LAVI)
    r += 1
    cab(r, ["regra", "o que é", "base", "tratamento", "nota"])
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
    return ws, fim_cod


def _atend_do_v3():
    """extrai o literal ATEND de gerar_saidas.py sem executar o resto do arquivo."""
    src = open(os.path.join(AQUI, "gerar_saidas.py"), encoding="utf-8").read()
    ini = src.index("ATEND = [")
    fim = src.index("\n]", ini) + 2
    ns = {}
    exec(src[ini:fim], {}, ns)
    return ns["ATEND"]


def aba_mes(wb, mes, DIAS, fim_cod, pessoas):
    nome = MESES_PT[mes - 1]
    ws = wb.create_sheet(nome)
    origem, nota = D.PROCEDENCIA[mes]
    ws.sheet_properties.tabColor = {"senior": SAGE, "grade": SAND,
                                   "montado": LAV, "vazio": LINE}[origem]
    ws.sheet_view.showGridLines = False
    ndias = (dt.date(2026, mes % 12 + 1, 1) - dt.timedelta(days=1)).day if mes < 12 else 31

    t = ws.cell(row=R_TIT, column=1, value=f"{MESES_LONGO[mes-1]} · 2026")
    t.font = Font(name=F, bold=True, size=14, color=LAVI)
    sub = ws.cell(row=R_TIT, column=C_D1, value=nota)
    sub.font = Font(name=F, size=9, italic=True, color=INK3)

    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 5
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
    for col, txt in ((C_MED, "médico"), (C_CH, "CH")):
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
    for i, txt in enumerate(COLS_TOT):
        col = C_TOT + i
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI if i < 6 else CORALI)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = 7.5

    semanas = round(ndias / 7, 2)
    for k, (apelido, ch) in enumerate(pessoas):
        lin = R_P0 + k
        cm = ws.cell(row=lin, column=C_MED, value=apelido)
        cm.font = Font(name=F, size=9, bold=True, color=INK)
        cc = ws.cell(row=lin, column=C_CH, value=ch)
        cc.font = Font(name=F, size=8, color=INK3)
        cc.alignment = Alignment(horizontal="center")
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

        eh = expr_horas(lin)
        f = [f"=SUMPRODUCT({eh})",
             f"=SUMPRODUCT(${L_D1}${R_FDS}:${L_DN}${R_FDS},{eh})",
             f'=SUMPRODUCT(${L_D1}${R_SEX}:${L_DN}${R_SEX},(${L_D1}{lin}:${L_DN}{lin}="N")*1)',
             f"=SUMPRODUCT(${L_D1}${R_FER}:${L_DN}${R_FER},{eh})",
             f"={get_column_letter(C_CH)}{lin}*{semanas}",
             f"={get_column_letter(C_TOT)}{lin}-{get_column_letter(C_TOT+4)}{lin}",
             f'=SUMPRODUCT((${L_D1}{lin}:${L_DN_1}{lin}="N")*'
             f'((${L_D2}{lin}:${L_DN}{lin}="M")+(${L_D2}{lin}:${L_DN}{lin}="E")'
             f'+(${L_D2}{lin}:${L_DN}{lin}="C")+(${L_D2}{lin}:${L_DN}{lin}="D")))',
             f'=SUMPRODUCT((${L_D1}{lin}:${L_DN_1}{lin}="N")*(${L_D2}{lin}:${L_DN}{lin}="T"))']
        for i, formula in enumerate(f):
            c = ws.cell(row=lin, column=C_TOT + i, value=formula)
            c.number_format = "0" if i in (2, 6, 7) else "0.#"
            c.font = Font(name=F, size=8, color=INK2 if i < 5 else INK)
            c.alignment = Alignment(horizontal="center")
            c.border = BOX
            if i == 5:
                c.font = Font(name=F, size=8, bold=True, color=INK)

    ultima = R_P0 + len(pessoas) - 1
    # ------- rodapé: lotação e falta
    r = ultima + 2
    # os grupos derivam dos flags da tabela de turnos (CONFIG colunas "conta ...").
    # Não repetir a lista à mão: foi assim que P/R entraram na cobertura sem querer.
    grupos = [(rot, [k for k, v in D.TURNOS.items() if v[4 + i]], i)
              for i, rot in enumerate(("manhã", "tarde", "noite"))]
    linhas_falta = []
    for gi, (rot, letras, idx) in enumerate(grupos):
        rl = r + gi
        ws.cell(row=rl, column=C_MED, value=rot).font = Font(
            name=F, size=9, bold=True, color=LAVI)
        rf = r + 3 + gi
        ws.cell(row=rf, column=C_MED, value=f"falta {rot}").font = Font(
            name=F, size=9, bold=True, color=CORALI)
        linhas_falta.append(rf)
        for i in range(ndias):
            col = get_column_letter(C_D1 + i)
            faixa = f"{col}{R_P0}:{col}{ultima}"
            conta = "+".join(f'COUNTIF({faixa},"{x}")' for x in letras)
            c = ws.cell(row=rl, column=C_D1 + i, value=f"={conta}")
            c.font = Font(name=F, size=8, color=INK2)
            c.alignment = Alignment(horizontal="center")
            data = dt.date(2026, mes, i + 1)
            # feriado escala como o dia da semana em que cai
            tipo = 4 if data.weekday() < 5 else (5 if data.weekday() == 5 else 6)
            ref = f"CONFIG!${get_column_letter(2+idx)}${tipo}"
            cf = ws.cell(row=rf, column=C_D1 + i,
                         value=f"=MAX(0,{ref}-{col}{rl})")
            cf.font = Font(name=F, size=8, bold=True, color=CORALI)
            cf.alignment = Alignment(horizontal="center")
    for rf in linhas_falta:
        faixa = f"{L_D1}{rf}:{L_DN}{rf}"
        ws.conditional_formatting.add(faixa, CellIsRule(
            operator="greaterThan", formula=["0"],
            fill=PatternFill("solid", bgColor=CORAL),
            font=Font(name=F, size=8, bold=True, color="FFFFFF")))
    ws.freeze_panes = f"{get_column_letter(C_D1)}{R_P0}"
    return ws


def aba_painel(wb, pessoas, oficial):
    ws = wb.create_sheet("PAINEL ANO")
    ws.sheet_properties.tabColor = LAVI
    estilo_titulo(ws, "painel do ano · o comparativo",
                  "cada número vem da aba do mês — não se digita nada aqui")
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 5
    ws.cell(row=R_HDR, column=C_MED, value="médico").font = Font(
        name=F, bold=True, size=9, color="FFFFFF")
    ws.cell(row=R_HDR, column=C_MED).fill = PatternFill("solid", fgColor=LAVI)
    ws.cell(row=R_HDR, column=C_CH, value="CH").font = Font(
        name=F, bold=True, size=9, color="FFFFFF")
    ws.cell(row=R_HDR, column=C_CH).fill = PatternFill("solid", fgColor=LAVI)

    # 4 blocos de 13 colunas (12 meses + total)
    blocos = [("saldo do mês (h)", C_TOT + 5, LAVS),
              ("fds (h)", C_TOT + 1, AQUAS),
              ("sexta-noite", C_TOT + 2, SANDS),
              ("feriado (h)", C_TOT + 3, CORALS)]
    col = 3
    inicio_bloco = {}
    for rot, col_origem, cor in blocos:
        ws.cell(row=R_DOW, column=col, value=rot).font = Font(
            name=F, bold=True, size=10, color=LAVI)
        ws.merge_cells(start_row=R_DOW, start_column=col, end_row=R_DOW, end_column=col + 12)
        inicio_bloco[rot] = col
        for i, m in enumerate(MESES_PT):
            c = ws.cell(row=R_HDR, column=col + i, value=m)
            c.font = Font(name=F, bold=True, size=8, color=INK)
            c.fill = PatternFill("solid", fgColor=cor)
            c.alignment = Alignment(horizontal="center")
            ws.column_dimensions[get_column_letter(col + i)].width = 5.4
        c = ws.cell(row=R_HDR, column=col + 12, value="ano")
        c.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        c.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(col + 12)].width = 6.5
        for k in range(len(pessoas)):
            lin = R_P0 + k
            for i, m in enumerate(MESES_PT):
                cel = ws.cell(row=lin, column=col + i,
                              value=f"={m}!${get_column_letter(col_origem)}{lin}")
                cel.number_format = "0" if rot == "sexta-noite" else "0.#"
                cel.font = Font(name=F, size=8, color=INK2)
                cel.alignment = Alignment(horizontal="center")
            tot = ws.cell(row=lin, column=col + 12,
                          value=f"=SUM({get_column_letter(col)}{lin}:"
                                f"{get_column_letter(col+11)}{lin})")
            tot.number_format = "0" if rot == "sexta-noite" else "0.#"
            tot.font = Font(name=F, size=8, bold=True, color=INK)
            tot.alignment = Alignment(horizontal="center")
            tot.fill = PatternFill("solid", fgColor=CREME)
        col += 14

    # conferência com a contagem manual antiga
    ws.cell(row=R_DOW, column=col, value="conferência · contagem manual antiga").font = Font(
        name=F, bold=True, size=10, color=CORALI)
    ws.merge_cells(start_row=R_DOW, start_column=col, end_row=R_DOW, end_column=col + 3)
    for i, h in enumerate(("SxN oficial", "SxN calc", "difere?", "")):
        if not h:
            continue
        c = ws.cell(row=R_HDR, column=col + i, value=h)
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
        base = get_column_letter(inicio_bloco["sexta-noite"])
        fim = get_column_letter(inicio_bloco["sexta-noite"] + 11)
        cc = ws.cell(row=lin, column=col + 1, value=f"=SUM({base}{lin}:{fim}{lin})")
        cc.font = Font(name=F, size=8, color=INK2)
        cc.alignment = Alignment(horizontal="center")
        L = get_column_letter(col)
        cd = ws.cell(row=lin, column=col + 2,
                     value=f'=IF({L}{lin}="","",IF({L}{lin}={get_column_letter(col+1)}{lin},"","⚠"))')
        cd.font = Font(name=F, size=9, bold=True, color=CORALI)
        cd.alignment = Alignment(horizontal="center")
    ws.freeze_panes = "C8"
    return ws


def aba_senior(wb, pessoas, fim_cod):
    ws = wb.create_sheet("SENIOR")
    ws.sheet_properties.tabColor = SAND
    ws.sheet_view.showGridLines = False
    t = ws.cell(row=R_TIT, column=1, value="códigos Senior")
    t.font = Font(name=F, bold=True, size=14, color=LAVI)
    sel = ws.cell(row=R_TIT, column=C_CH, value="OUT")
    sel.font = Font(name=F, bold=True, size=13, color=CORALI)
    sel.fill = PatternFill("solid", fgColor=SANDS)
    sel.alignment = Alignment(horizontal="center")
    dv = DataValidation(type="list", formula1='"' + ",".join(MESES_PT) + '"',
                        allow_blank=False, showDropDown=False)
    ws.add_data_validation(dv)
    dv.add(sel)
    inst = ws.cell(row=R_TIT, column=C_D1,
                   value="escolha o mês na célula ao lado — a matriz inteira se traduz "
                         "nos códigos do RH, pronta pra lançar no Senior")
    inst.font = Font(name=F, size=9, italic=True, color=INK3)

    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 6
    for col, txt in ((C_MED, "médico"), (C_CH, "mês")):
        c = ws.cell(row=R_HDR, column=col, value=txt)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
    for i in range(31):
        col = C_D1 + i
        ws.column_dimensions[get_column_letter(col)].width = 5
        for r, formula in ((R_DIA, f'=IFERROR(INDIRECT($B$1&"!{get_column_letter(col)}{R_DIA}"),"")'),
                           (R_DOW, f'=IFERROR(INDIRECT($B$1&"!{get_column_letter(col)}{R_DOW}"),"")')):
            c = ws.cell(row=r, column=col, value=formula)
            c.font = Font(name=F, bold=(r == R_DIA), size=8, color=INK if r == R_DIA else INK3)
            c.alignment = Alignment(horizontal="center")

    nomes = {a: n for a, n, *_ in D.ROSTER}
    faixa_cod = f"CONFIG!$A$10:$B${fim_cod}"
    for k, (apelido, _ch) in enumerate(pessoas):
        lin = R_P0 + k
        c = ws.cell(row=lin, column=C_MED, value=nomes.get(apelido, apelido))
        c.font = Font(name=F, size=9, color=INK)
        for i in range(31):
            col = C_D1 + i
            cel = ws.cell(row=lin, column=col, value=(
                f'=IFERROR(VLOOKUP(INDIRECT($B$1&"!"&ADDRESS(ROW(),COLUMN(),4)),'
                f'{faixa_cod},2,FALSE),"")'))
            cel.font = Font(name=F, size=8, color=INK)
            cel.alignment = Alignment(horizontal="center")
            cel.border = BOX
    ws.freeze_panes = f"{get_column_letter(C_D1)}{R_P0}"
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
    estilo_titulo(ws, "validador · o que fere regra dura",
                  "estrutural = a forma do contrato · pontual = erro daquele mês")
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
        c.font = Font(name=F, bold=True, size=12, color=cor)
        r += 1
        e = ws.cell(row=r, column=1, value=explicacao)
        e.font = Font(name=F, size=9, italic=True, color=INK2)
        e.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        ws.row_dimensions[r].height = 28
        r += 2

    def cabecalho():
        nonlocal r
        for i, h in enumerate(("médico", "grupo", "quando", "o que acontece",
                               "base", "tratamento"), start=1):
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
    c.font = Font(name=F, bold=True, size=12, color=LAVI)
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
    ws.cell(row=r, column=1, value="médico").font = Font(name=F, bold=True, size=8, color="FFFFFF")
    ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor=LAVI)
    for i, m in enumerate(MESES_PT):
        cc = ws.cell(row=r, column=2 + i, value=m)
        cc.font = Font(name=F, bold=True, size=8, color="FFFFFF")
        cc.fill = PatternFill("solid", fgColor=LAVI)
        cc.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(2 + i)].width = 6
    ws.cell(row=r, column=14, value="ano").font = Font(name=F, bold=True, size=8, color="FFFFFF")
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
    ws.freeze_panes = "A4"
    return ws


def abas_mes_vivo(wb, ns):
    atend = _atend_do_v3()
    ws = wb.create_sheet("ATENDIMENTO")
    ws.sheet_properties.tabColor = PINK
    estilo_titulo(ws, "atendimento e justificativas · outubro 2026")
    sub = ws.cell(row=2, column=1, value="Cobertura 100% nos 31 dias · convocações na aba "
                  "ao lado · critério público, sem favoritismo")
    sub.font = Font(name=F, size=10, italic=True, color=INK2)
    for j, (h, w) in enumerate(zip(["quem / o quê", "status",
                                    "justificativa (critério público)"],
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
    ws.freeze_panes = "A5"

    ws2 = wb.create_sheet("CONVOCAÇÕES")
    ws2.sheet_properties.tabColor = CORALI
    estilo_titulo(ws2, "convocações · outubro 2026",
                  "quem entrou fora da própria preferência, e por qual critério")
    convoc = ns.get("CONVOC", [])
    nconv = {}
    for ap, _d, _s in convoc:
        nconv[ap] = nconv.get(ap, 0) + 1
    exp = ws2.cell(row=2, column=1, value=(
        f"{len(convoc)} convocações. Critério público, na ordem: 1º quem estava abaixo da "
        "própria carga no mês; 2º quem tinha menos convocações. Impedimento com motivo "
        "declarado (outro serviço, filhos, viagem, atestado) é intocável — ninguém foi "
        "convocado contra impedimento real. Toda convocação gera CRÉDITO no mês seguinte: "
        "prioridade nas preferências."))
    exp.font = Font(name=F, size=10, color=INK2)
    exp.alignment = Alignment(wrap_text=True, vertical="top")
    ws2.merge_cells(start_row=2, start_column=1, end_row=3, end_column=5)
    for j, (h, w) in enumerate(zip(["médico", "convocações", "dias", "crédito em novembro"],
                                   [16, 12, 46, 22]), start=1):
        c = ws2.cell(row=5, column=j, value=h)
        c.font = Font(name=F, bold=True, size=9, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=LAVI)
        ws2.column_dimensions[get_column_letter(j)].width = w
    r = 6
    wd = ns["wd"]
    for ap, n in sorted(nconv.items(), key=lambda x: (-x[1], x[0])):
        dias_txt = " · ".join(
            f"{d:02d}/{WD_PT[wd(d)]} {s}" for a2, d, s in sorted(convoc, key=lambda x: x[1])
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
    ws2.freeze_panes = "A6"


def main():
    DIAS, rel_grade, ns = carregar_dados()
    oficial = contagem_oficial_sxn()
    pessoas = [(a, ch) for a, _n, ch, *_ in D.ROSTER]

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    aba_leiame(wb, rel_grade)
    aba_cadastro(wb)
    _cfg, fim_cod = aba_config(wb)
    for mes in range(1, 13):
        aba_mes(wb, mes, DIAS, fim_cod, pessoas)
    aba_painel(wb, pessoas, oficial)
    aba_senior(wb, pessoas, fim_cod)
    aba_validador(wb, DIAS, pessoas)
    abas_mes_vivo(wb, ns)

    destino = os.path.join(AQUI, "Escala UTI HCB 2026 - unificada v4.xlsx")
    wb.save(destino)
    tam = os.path.getsize(destino) / 1024
    print(f"\n=== planilha v4 salva ===\n{destino}\n{tam:.0f} kb · {len(wb.sheetnames)} abas")
    print("abas:", " · ".join(wb.sheetnames))
    return destino


if __name__ == "__main__":
    main()
