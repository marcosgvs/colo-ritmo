#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Passe final no Sheet vivo: gráficos nativos + acabamento que o xlsx não carrega.

Roda DEPOIS de gsuite.atualizar_sheet(). A ordem do pipeline é:
    build_unificada_v4.py  →  gsuite.atualizar_sheet()  →  dash_sheets.py

Formas escolhidas pela função do dado, não por gosto:
- alertas de 18h por mês: ÊNFASE (uma série, um matiz) — a história é a queda
  depois de abril, não comparar categorias;
- buracos por mês: uma série, sequencial;
- manhã/tarde/noite: ORDEM do dia → rampa clara→escura (não matizes distintos);
- distribuição do saldo: POLARIDADE → par divergente coral↔azul, neutro no meio.

Sem eixo duplo em nenhum gráfico. Legenda quando há 2+ séries; nenhuma quando há 1
(o título nomeia a série).
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import gsuite
import v4_dados as D
import v4_dashboard as VD

ARQUIVO_ID = "102d4E3IzlSXH4MDU6hd9ywr21BxthHdqL9meBP-IX7s"


def rgb(hexa):
    h = hexa.lstrip("#")
    return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255,
            "blue": int(h[4:6], 16) / 255}


def ids_das_abas(sid):
    meta = gsuite.sheets().spreadsheets().get(
        spreadsheetId=sid, fields="sheets(properties(title,sheetId))").execute()
    return {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}


def faixa(aba_id, r1, c1, r2, c2):
    return {"sheetId": aba_id, "startRowIndex": r1, "endRowIndex": r2,
            "startColumnIndex": c1, "endColumnIndex": c2}


def _serie(dados_id, col, r1, r2, cor, rotulo_pontos=False, eixo="LEFT_AXIS",
           com_cabecalho=False):
    """eixo: BAR (horizontal) só aceita série no BOTTOM_AXIS.

    com_cabecalho estende a faixa uma linha acima para incluir o título da coluna:
    é de lá que a legenda tira o TEXTO. Sem isso a legenda vira três quadradinhos
    coloridos sem nome — identidade por cor sozinha, que é falha de acessibilidade.
    """
    inicio = r1 - 1 if com_cabecalho else r1
    s = {"series": {"sourceRange": {"sources": [faixa(dados_id, inicio, col, r2, col + 1)]}},
         "targetAxis": eixo,
         "colorStyle": {"rgbColor": rgb(cor)}}
    if rotulo_pontos:
        s["dataLabel"] = {"type": "DATA", "placement": "OUTSIDE_END", "textFormat": {
            "fontFamily": VD.CORPO, "fontSize": 9,
            "foregroundColorStyle": {"rgbColor": rgb(VD.INK2)}}}
    return s


def grafico(dash_id, dados_id, titulo, subtitulo, tipo, dominio, series,
            ancora, largura, altura, legenda="NO_LEGEND", eixo_y="",
            com_cabecalho=False):
    spec = {
        "title": titulo,
        "subtitle": subtitulo,
        "titleTextFormat": {"fontFamily": VD.CORPO, "fontSize": 12, "bold": True,
                            "foregroundColorStyle": {"rgbColor": rgb(VD.INK)}},
        "subtitleTextFormat": {"fontFamily": VD.CORPO, "fontSize": 9,
                               "foregroundColorStyle": {"rgbColor": rgb(VD.INK3)}},
        "fontName": VD.CORPO,
        "backgroundColorStyle": {"rgbColor": rgb(VD.BG)},
        "basicChart": {
            "chartType": tipo,
            "legendPosition": legenda,
            "headerCount": 1 if com_cabecalho else 0,
            # num BAR os papéis se invertem: categoria à esquerda, valor embaixo
            "axis": [
                {"position": "BOTTOM_AXIS",
                 "title": eixo_y if tipo == "BAR" else "",
                 "format": {"fontFamily": VD.CORPO, "fontSize": 9,
                            "foregroundColorStyle": {"rgbColor": rgb(VD.INK3)}}},
                {"position": "LEFT_AXIS",
                 "title": "" if tipo == "BAR" else eixo_y,
                 "format": {"fontFamily": VD.CORPO, "fontSize": 9,
                            "foregroundColorStyle": {"rgbColor": rgb(VD.INK3)}}},
            ],
            # com cabeçalho a série sobe uma linha; o DOMÍNIO tem que subir junto,
            # senão categoria e valor ficam desalinhados em uma posição
            "domains": [{"domain": {"sourceRange": {"sources": [
                dict(dominio, startRowIndex=dominio["startRowIndex"] - 1)
                if com_cabecalho else dominio]}}}],
            "series": series,
        },
    }
    return {"addChart": {"chart": {
        "spec": spec,
        "position": {"overlayPosition": {
            "anchorCell": {"sheetId": dash_id, "rowIndex": ancora[0],
                           "columnIndex": ancora[1]},
            "widthPixels": largura, "heightPixels": altura}}}}}


def limpar_graficos(sid, dash_id):
    meta = gsuite.sheets().spreadsheets().get(
        spreadsheetId=sid, fields="sheets(properties(sheetId),charts(chartId))").execute()
    pedidos = []
    for s in meta["sheets"]:
        if s["properties"]["sheetId"] == dash_id:
            for ch in s.get("charts", []):
                pedidos.append({"deleteEmbeddedObject": {"objectId": ch["chartId"]}})
    return pedidos


LEGENDA = ("M manhã 7–13h · T tarde 13–19h · D dia 7–19h · N noite 19–7h · "
           "NT noitinha 19–1h · C chefia 10h · J Janaina 8–13h · CEP 4h · CP paliativos · "
           "CRO ambulatório · A administrativo · + = BHP (a mais, banco) · − = BHN (dispensa) · "
           "FE férias · LM licença · AB abono")
CODIGOS_VALIDOS = list(D.TURNOS)
MENSAIS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]


def dropdowns(ids):
    """dropdown em toda célula de plantão das 12 mensais, com a legenda como
    mensagem de ajuda — clicar na célula mostra o que cada sigla significa e a
    setinha abre a lista pra trocar. strict=False: valor fora da lista vira
    aviso, não bloqueio (a Mari manda na escala, não o validador)."""
    pedidos = []
    for m in MENSAIS:
        if m not in ids:
            continue
        pedidos.append({"setDataValidation": {
            # colunas I..AM (só os dias DO mês). Vésperas (C..H) e virada
            # (AN..AS) ficam FORA de propósito: são fórmulas das abas vizinhas —
            # o dropdown ali deixaria alguém sobrescrever a fórmula sem perceber
            "range": {"sheetId": ids[m], "startRowIndex": 7, "endRowIndex": 73,
                      "startColumnIndex": 8, "endColumnIndex": 39},
            "rule": {
                "condition": {"type": "ONE_OF_LIST",
                              "values": [{"userEnteredValue": c} for c in CODIGOS_VALIDOS]},
                "inputMessage": LEGENDA,
                "strict": False,
                "showCustomUi": True,
            }}})
    return pedidos


def limpar_vistas(sid):
    """apaga vistas de filtro que alguém tenha criado. A ordenação oficial é o
    FILTRO BÁSICO (abaixo) — desde 28/08 as fórmulas acham cada pessoa pelo
    nome (INDEX/MATCH), então ordenar mover as linhas deixou de ser problema;
    mas vista de filtro duplicada só confunde."""
    meta = gsuite.sheets().spreadsheets().get(
        spreadsheetId=sid, fields="sheets(filterViews(filterViewId))").execute()
    pedidos = []
    for s in meta.get("sheets", []):
        for fv in s.get("filterViews", []):
            pedidos.append({"deleteFilterView": {"filterId": fv["filterViewId"]}})
    return pedidos


# última coluna das mensais (1-based): Nº = C_TOT(46) + 24 → 70 (BR) — V3
FIM_COLS_IDX = 70


def filtros_basicos(ids):
    """UM filtro básico por aba mensal, do cabeçalho (linha 7) até a última
    pessoa (linha 73), largura inteira até a coluna Nº. É por ele que a Mari
    ordena NA PRÓPRIA aba: funil de “Médico” = A a Z · funil de
    “Grupo” = coordenação→rotina→staff · funil de “Nº” = ordem
    original. As linhas se movem DE VERDADE — e podem: toda referência cruzada
    é por nome desde 28/08. O rodapé (cobertura/falta) fica fora do intervalo."""
    pedidos = []
    for m in MENSAIS:
        if m not in ids:
            continue
        pedidos.append({"setBasicFilter": {"filter": {
            "range": {"sheetId": ids[m], "startRowIndex": 6, "endRowIndex": 73,
                      "startColumnIndex": 0, "endColumnIndex": FIM_COLS_IDX}}}})
    return pedidos


def montar(sid=ARQUIVO_ID):
    ids = ids_das_abas(sid)
    dash, dados = ids["DASHBOARD"], ids["DADOS DASH"]
    D0, D1 = 4, 16          # linhas 5..16 do DADOS DASH = jan..dez (0-based)
    meses = faixa(dados, D0, 0, D1, 1)

    pedidos = limpar_graficos(sid, dash)
    pedidos += limpar_vistas(sid)
    pedidos += dropdowns(ids)
    pedidos += filtros_basicos(ids)

    # 1 · a história do ano: os alertas de 18h caíram depois de abril
    pedidos.append(grafico(
        dash, dados,
        "Alertas de 18h por mês",
        "Noite emendando manhã, com 2h de descanso ou menos · o alvo é zero (art. 66 CLT)",
        "COLUMN", meses,
        [_serie(dados, 1, D0, D1, VD.ERR, rotulo_pontos=True)],
        ancora=(30, 1), largura=620, altura=260, eixo_y="Casos"))

    # 2 · buracos de cobertura por mês
    pedidos.append(grafico(
        dash, dados,
        "Buracos de cobertura por mês",
        "Soma do que faltou para o mínimo · cada mês medido pela regra que valia na época",
        "COLUMN", meses,
        [_serie(dados, 2, D0, D1, VD.LAVI, rotulo_pontos=True)],
        ancora=(30, 9), largura=620, altura=260, eixo_y="Horas-turno"))

    # 3 · lotação média por turno — ordem do dia, rampa clara→escura
    pedidos.append(grafico(
        dash, dados,
        "Lotação média por turno",
        "Manhã, tarde e noite ao longo do ano · a tarde é o gargalo estrutural",
        "LINE", meses,
        [_serie(dados, 4, D0, D1, VD.RAMPA[0], com_cabecalho=True),
         _serie(dados, 5, D0, D1, VD.RAMPA[1], com_cabecalho=True),
         _serie(dados, 6, D0, D1, VD.RAMPA[2], com_cabecalho=True)],
        ancora=(45, 1), largura=620, altura=260, legenda="BOTTOM_LEGEND",
        eixo_y="Pessoas por turno", com_cabecalho=True))

    # 4 · distribuição do saldo: polaridade, divergente em volta do zero
    pedidos.append(grafico(
        dash, dados,
        "Distribuição do saldo · Outubro",
        "Quantas pessoas estão devendo horas e quantas fizeram a mais",
        "BAR", faixa(dados, 21, 0, 29, 1),
        # duas séries = o divergente ganha as duas cores; uma série só no Sheets
        # não aceita cor por ponto
        [_serie(dados, 1, 21, 29, VD.NEG, rotulo_pontos=True, eixo="BOTTOM_AXIS",
                com_cabecalho=True),
         _serie(dados, 2, 21, 29, VD.POS, rotulo_pontos=True, eixo="BOTTOM_AXIS",
                com_cabecalho=True)],
        # mais alto: com 7 categorias o Sheets começa a pular rótulo do eixo
        ancora=(45, 9), largura=620, altura=300, legenda="BOTTOM_LEGEND",
        eixo_y="Pessoas", com_cabecalho=True))
    return pedidos, ids


if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else ARQUIVO_ID
    pedidos, ids = montar(sid)
    r = gsuite.sheets().spreadsheets().batchUpdate(
        spreadsheetId=sid, body={"requests": pedidos}).execute()
    print(f"{len(pedidos)} pedidos aplicados · "
          f"{sum(1 for x in r.get('replies', []) if x.get('addChart'))} gráficos criados")
