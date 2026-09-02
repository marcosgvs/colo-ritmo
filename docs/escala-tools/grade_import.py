#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Importa jan/mai/jun/set de 2026 a partir das GRADES do grupo.

A grade é um bloco por dia com os nomes empilhados em colunas Manhã | Tarde | Noite | Noitinha.
Reconstrução: manhã+tarde no mesmo dia = 12h dia (D); só manhã = M; só tarde = T;
noite = N; noitinha = NT.

FIDELIDADE MENOR que os meses vindos dos códigos Senior — registrar isso na planilha:
- 47 (10h chefia) aparece só como nome na coluna Manhã → entra como M (6h), perde 4h;
- 6 (4h CEP) e 78 (5h Janaina) idem, viram M/T;
- sufixos BHP/BHN viram códigos + e − (banco de horas); CEP/CP/CRO viram o código do serviço.
"""
import datetime as dt
import os
import re
import unicodedata

import openpyxl

DIR_FONTES = os.path.expanduser("~/Downloads/fwdarquivosdaescala")
nfc = lambda s: unicodedata.normalize("NFC", s)

ARQUIVOS = {
    # mês: (arquivo, aba, coluna da Manhã ou None = achar pelo cabeçalho)
    1: ("ESCALA FINAL JANEIRO 2026.xlsx", "Table 1", None),
    5: ("Escala maio UTI - HCB - última revisão 09.04.26.docx.xlsx", "Table 1", None),
    6: ("Escala junho - UTI HCB.xlsx", "Junho 2026", None),
    # setembro: a grade do grupo é a fonte (o arquivo Senior de set/26 veio
    # incompleto em 29 e 30/09). Sem cabeçalho "Manhã": dia na col. C, M/T/N/NT em D..G
    9: ("Escala setembro - UTI HCB.xlsx", "Setembro 2026", 4),
}

DIAS_SEMANA = {"SEGUNDA": 0, "TERÇA": 1, "TERCA": 1, "QUARTA": 2, "QUINTA": 3,
               "SEXTA": 4, "SÁBADO": 5, "SABADO": 5, "DOMINGO": 6}

# sufixos de anotação que vêm colados no nome. BHP/BHN/CEP/CP/CRO são LIDOS
# (viram código: M+ M- CEP CP CRO); Pr/PR/ICDF/(…) são só descartados
ANOTACAO = re.compile(r"\b(BHP|BHN|CEP|CRO|CP)\b", re.I)
SUFIXOS = re.compile(r"\s+(BHP|BHN|BH|CRO|CP|CEP|Pr|PR|ICDF|\(.*\))\s*$", re.I)
DISPENSA = re.compile(r"\bBHN\b", re.I)
# linhas que não são pessoa
NAO_PESSOA = re.compile(r"^(niver|anivers|obs\b|feriado|total|legenda|coord)|^(manh[ãa]|tarde|noite|noitinha|dia)$", re.I)

# a grade escreve alguns nomes diferente do roster
ALIASES = {"Ste": "Stephanie", "Patricia Abreu": "Patricia", "PatiAbreu": "Patricia",
           "Msalomao": "MSalomão", "Mpinheiro": "MPinheiro", "Lelemos": "LeLemos",
           "Pjamile": "Pjamile", "Isabela": "IsaRibeiro", "Marina": "MSalomão"}


def _anotacao(nome):
    """BHP / BHN / CEP / CP / CRO colado no nome, ou None."""
    m = ANOTACAO.search(nfc(str(nome)))
    return m.group(1).upper() if m else None


def _limpar(nome):
    s = nfc(str(nome).strip())
    if not s or NAO_PESSOA.match(s):
        return None
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
    nome_arq, aba, cM = ARQUIVOS[mes]
    wb = openpyxl.load_workbook(os.path.join(DIR_FONTES, nome_arq), data_only=True)
    ws = wb[aba]

    # coluna da Manhã: explícita, ou pelo cabeçalho; janeiro não tem cabeçalho → 3
    for r in range(1, (min(ws.max_row, 60) + 1) if cM is None else 1):
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
            turnos.setdefault((apelido, dia_atual), {})[janela] = _anotacao(v)

    dias = {}
    for (apelido, dia), janelas in turnos.items():
        data = dt.date(2026, mes, dia)
        dias.setdefault(data, {})[apelido] = (_compor(janelas), "grade")
    return dias, sorted(naocasados)


def _compor(janelas):
    """{janela: anotação} de um dia → código da planilha.

    Manhã + tarde = D. BHP num período vira '+', BHN vira '-': M+ (manhã a mais),
    Dm+ (dia em que a manhã é BHP), M- (dispensa da manhã, não trabalha), Tm-
    (trabalha a tarde, a manhã é dispensa) etc. CEP/CP/CRO são serviços próprios.
    """
    for servico in ("CEP", "CP", "CRO"):
        if servico in janelas.values():
            return servico
    m, t = janelas.get("M", "ausente"), janelas.get("T", "ausente")
    tem_m, tem_t = "M" in janelas, "T" in janelas
    if tem_m and tem_t:
        if m == "BHN" and t == "BHN":
            return "D-"
        if m == "BHN":
            return "Tm-"
        if t == "BHN":
            return "Mt-"
        if m == "BHP" and t == "BHP":
            return "D+"
        if m == "BHP":
            return "Dm+"
        if t == "BHP":
            return "Dt+"
        return "D"           # dia + noite no mesmo dia: 18h — o validador pega
    if tem_m:
        return {"BHP": "M+", "BHN": "M-"}.get(m, "M")
    if tem_t:
        return {"BHP": "T+", "BHN": "T-"}.get(t, "T")
    if "N" in janelas:
        return {"BHP": "N+", "BHN": "N-"}.get(janelas["N"], "N")
    return "NT"


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
