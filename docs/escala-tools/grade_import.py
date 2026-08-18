#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Importa jan/mai/jun de 2026 a partir das GRADES (não têm arquivo de códigos Senior).

A grade é um bloco por dia com os nomes empilhados em colunas Manhã | Tarde | Noite | Noitinha.
Reconstrução: manhã+tarde no mesmo dia = 12h dia (D); só manhã = M; só tarde = T;
noite = N; noitinha = NT.

FIDELIDADE MENOR que os meses vindos dos códigos Senior — registrar isso na planilha:
- 47 (10h chefia) aparece só como nome na coluna Manhã → entra como M (6h), perde 4h;
- 6 (4h CEP) e 78 (5h Janaina) idem, viram M/T;
- sufixos BHP/BHN/CRO/CP/CEP são anotações de banco de horas e serviço, não turno.
"""
import datetime as dt
import os
import re
import unicodedata

import openpyxl

DIR_FONTES = os.path.expanduser("~/Downloads/fwdarquivosdaescala")
nfc = lambda s: unicodedata.normalize("NFC", s)

ARQUIVOS = {
    1: ("ESCALA FINAL JANEIRO 2026.xlsx", "Table 1"),
    5: ("Escala maio UTI - HCB - última revisão 09.04.26.docx.xlsx", "Table 1"),
    6: ("Escala junho - UTI HCB.xlsx", "Junho 2026"),
}

DIAS_SEMANA = {"SEGUNDA": 0, "TERÇA": 1, "TERCA": 1, "QUARTA": 2, "QUINTA": 3,
               "SEXTA": 4, "SÁBADO": 5, "SABADO": 5, "DOMINGO": 6}

# sufixos de anotação que vêm colados no nome
SUFIXOS = re.compile(r"\s+(BHP|BH|CRO|CP|CEP|Pr|PR|ICDF|\(.*\))\s*$", re.I)
# BHN = banco de horas NEGATIVO: "NÃO vá ao plantão". É dispensa do fixo, não turno —
# contar como plantão infla a lotação (era um bug meu na 1a versão).
DISPENSA = re.compile(r"\bBHN\b", re.I)
# linhas que não são pessoa
NAO_PESSOA = re.compile(r"^(niver|anivers|obs\b|feriado|total|legenda|coord)|^(manh[ãa]|tarde|noite|noitinha|dia)$", re.I)

# a grade escreve alguns nomes diferente do roster
ALIASES = {"Ste": "Stephanie", "Patricia Abreu": "Patricia", "PatiAbreu": "Patricia",
           "Msalomao": "MSalomão", "Mpinheiro": "MPinheiro", "Lelemos": "LeLemos",
           "Pjamile": "Pjamile", "Isabela": "IsaRibeiro", "Marina": "MSalomão"}


def _limpar(nome):
    s = nfc(str(nome).strip())
    if not s or NAO_PESSOA.match(s):
        return None
    if DISPENSA.search(s):
        return None          # BHN dispensa do plantão: não entra na escala
    anterior = None
    while anterior != s:
        anterior = s
        s = SUFIXOS.sub("", s).strip()
    return s or None


def _canonico(nome, roster):
    nome = ALIASES.get(nome, nome)
    """casa o nome da grade com o apelido do roster, ignorando caixa e acento."""
    chave = unicodedata.normalize("NFD", nome.lower()).encode("ascii", "ignore")
    for apelido in roster:
        alvo = unicodedata.normalize("NFD", apelido.lower()).encode("ascii", "ignore")
        if chave == alvo:
            return apelido
    return None


def ler_grade(mes, roster):
    nome_arq, aba = ARQUIVOS[mes]
    wb = openpyxl.load_workbook(os.path.join(DIR_FONTES, nome_arq), data_only=True)
    ws = wb[aba]

    # coluna da Manhã: pelo cabeçalho; janeiro não tem cabeçalho → 3
    cM = None
    for r in range(1, min(ws.max_row, 60) + 1):
        for c in range(1, min(ws.max_column, 12) + 1):
            v = ws.cell(row=r, column=c).value
            if v and nfc(str(v).strip()).upper().startswith("MANH"):
                cM = c
                break
        if cM:
            break
    if cM is None:
        cM = 3
    cT, cN, cNT = cM + 1, cM + 2, cM + 3

    ultimo = (dt.date(2026, mes % 12 + 1, 1) - dt.timedelta(days=1)).day
    turnos = {}           # (apelido, dia) -> set de janelas
    dia_atual = None
    naocasados = set()
    for r in range(1, ws.max_row + 1):
        linha = [ws.cell(row=r, column=c).value for c in range(1, cM)]
        # número explícito do dia
        # o número do dia às vezes vem como texto ('1') e não como inteiro
        def _inteiro(v):
            if isinstance(v, (int, float)) and float(v).is_integer():
                return int(v)
            if isinstance(v, str) and v.strip().isdigit():
                return int(v.strip())
            return None
        numero = next((n for n in (_inteiro(v) for v in linha)
                       if n is not None and 1 <= n <= ultimo), None)
        # nome do dia da semana (junho perde o número depois da 1a semana)
        nome_dow = next((DIAS_SEMANA[nfc(str(v)).strip().upper()] for v in linha
                         if isinstance(v, str)
                         and nfc(str(v)).strip().upper() in DIAS_SEMANA), None)
        if numero is not None:
            # o arquivo do mês carrega a 1a semana do mês SEGUINTE no fim
            # (handoff por semanas completas). O número do dia reinicia: quando
            # ele volta pra trás, começou outro mês — para de ler aqui.
            if dia_atual is not None and numero < dia_atual:
                break
            dia_atual = numero
        elif nome_dow is not None:
            # avança do dia corrente até casar o dia-da-semana
            candidato = (dia_atual or 0) + 1
            while candidato <= ultimo and dt.date(2026, mes, candidato).weekday() != nome_dow:
                candidato += 1
            if candidato <= ultimo:
                dia_atual = candidato
        if dia_atual is None:
            continue
        for coluna, janela in ((cM, "M"), (cT, "T"), (cN, "N"), (cNT, "NT")):
            v = ws.cell(row=r, column=coluna).value
            if v in (None, ""):
                continue
            limpo = _limpar(v)
            if not limpo:
                continue
            apelido = _canonico(limpo, roster)
            if apelido is None:
                naocasados.add(limpo)
                continue
            turnos.setdefault((apelido, dia_atual), set()).add(janela)

    # manhã + tarde no mesmo dia = 12h dia
    dias = {}
    for (apelido, dia), janelas in turnos.items():
        if {"M", "T"} <= janelas:
            letras = ["D"] + [x for x in janelas if x not in ("M", "T")]
        else:
            letras = sorted(janelas, key=lambda x: ("M", "T", "N", "NT").index(x))
        letra = "D" if "D" in letras else letras[0]
        if "N" in janelas and letra == "D":
            letra = "D"          # dia + noite no mesmo dia: 18h — o validador pega
        data = dt.date(2026, mes, dia)
        dias.setdefault(data, {})[apelido] = (letra, "grade")
    return dias, sorted(naocasados)


def importar(roster):
    DIAS, relatorio = {}, {}
    for mes in sorted(ARQUIVOS):
        dias, naocasados = ler_grade(mes, roster)
        for data, pessoas in dias.items():
            DIAS.setdefault(data, {}).update(pessoas)
        relatorio[mes] = {"dias": len(dias), "naocasados": naocasados,
                          "lancamentos": sum(len(v) for v in dias.values())}
    return DIAS, relatorio


if __name__ == "__main__":
    from senior_import import MAPA_NOMES
    roster = sorted(set(MAPA_NOMES.values()))
    DIAS, rel = importar(roster)
    for mes, r in rel.items():
        print(f"mês {mes}: {r['dias']} dias · {r['lancamentos']} lançamentos")
        if r["naocasados"]:
            print(f"   não casados: {r['naocasados']}")
    # sanidade: lotação por turno num dia útil
    from collections import Counter
    print("\n=== lotação reconstruída (mínimo útil: 14 M / 10 T / 7 N) ===")
    for data in sorted(DIAS)[:1] + [d for d in sorted(DIAS) if d.day in (2, 3, 10, 17)][:6]:
        c = Counter(v[0] for v in DIAS[data].values())
        wd = ["seg","ter","qua","qui","sex","sáb","dom"][data.weekday()]
        m = c["M"] + c["D"]; t = c["T"] + c["D"]; n = c["N"]
        print(f"  {data:%d/%m} ({wd})  manhã {m:2d} · tarde {t:2d} · noite {n:2d}")
