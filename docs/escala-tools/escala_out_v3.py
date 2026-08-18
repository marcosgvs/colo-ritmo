#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Escala OUTUBRO/2026 — UTI HCB — montagem definitiva (58 preferências).

Regras: cobertura útil 14/10/7 · sáb 10/8/7 (10ª manhã = Janaina) · dom 9/8/7.
Cota fds c/ férias: 2sem 36→24/30→18/24→12 · 1sem 36→30/30→24/24→18.
Sem 18h no mesmo dia, sem 18h invertido. Feriado 12/10: rotina folga (combinado
MSalomão) — meta = mínimo de domingo, melhor esforço acima disso.
Laura e Moabe: SEM preferências (padrão set/fixos — provisório).
"""
import datetime as dt

FERIADO = {12}
def wd(day):
    return dt.date(2026, 10, day).weekday()

def mins(d):
    if d in FERIADO:
        return (9, 8, 7)  # rotina folga (MSalomão) → tratar como domingo
    if wd(d) < 5:
        return (14, 10, 7)
    return (10, 8, 7) if wd(d) == 5 else (9, 8, 7)

HOURS = {"M": 6, "T": 6, "D": 12, "N": 12, "NT": 6, "C": 10, "A": 8, "J": 5,
         "E": 4, "P": 6, "R": 6, "AB": 6, "FE": 0, "LM": 0}
CM = {"M", "D", "C", "J"}; CT = {"T", "D", "C"}; CN = {"N", "NT"}

def rng(a, b): return list(range(a, b + 1))

PLAN = {}
def P(ap, spec, fe=None, lm=None):
    d = {}
    if fe:
        for x in rng(*fe): d[x] = "FE"
    if lm:
        for x in rng(*lm): d[x] = "LM"
    for code, days in spec.items():
        for x in days: d[x] = code
    PLAN[ap] = d

# ================= CHEFIA / ROTINA (rotina folga o feriado 12) =============
P("Fred",     {"C": [5, 6, 9, 13, 19, 20, 26, 27, 30], "M": [1, 7, 8, 10, 11, 14, 15, 21, 22, 28, 29, 31]})
P("Milena",   {"C": [1, 2, 8, 15, 22, 23, 29], "M": [3, 4, 5, 6, 7, 13, 14, 19, 20, 21, 24, 25, 26, 27, 28, 30]})
P("Pabdo",    {"C": [6, 16, 20], "M": [1, 2, 5, 7, 8, 9, 13, 14, 15, 17, 18, 19, 21, 22, 23, 26, 27, 28, 29, 30]})
P("Murilo",   {"M": [1, 2, 5, 6, 7, 8, 9, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30], "N": [10, 24]})
P("MSalomão", {"M": [1, 2, 5, 6, 7, 9, 13, 14, 16, 19, 20, 21, 23, 24, 26, 27, 28, 30],
               "D": [8, 15, 22, 29], "N": [4, 18]})
P("DebAlves", {"M": [1, 2, 5, 7, 9, 13, 14, 16, 19, 21, 22, 23, 26, 28, 29, 30],
               "D": [6, 8, 10, 15, 20, 24, 27]})
P("Vinicius", {"M": [1, 2, 5, 6, 7, 8, 9, 27, 28, 29, 30], "N": [3, 31]}, fe=(12, 26))
P("Amelio",   {"M": [1, 2, 4, 5, 8, 15, 18, 22, 23], "D": [3, 6, 13, 16, 17, 19, 20]})
P("Janaina",  {"J": [1, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31]})

# ================= PREFERÊNCIAS (autorais, dos e-mails) =====================
P("Aline",    {"N": [2, 5, 10, 12, 15], "T": [3, 8], "M": [7], "D": [14], "E": [6]}, fe=(19, 31))
P("Amanda",   {"D": [13, 14, 25], "T": [18, 23], "N": [19, 30], "M": [27, 28]}, fe=(1, 11))
P("AnaSeverino", {"N": [3, 8, 24, 29], "D": [5, 13, 16, 26], "M": [19, 20, 31]})
P("Anna",     {"N": [3, 30, 31], "T": [4, 5, 12, 19, 26], "D": [7, 14, 21], "M": [9, 16, 23]})
P("Ariadne",  {"N": [27, 29]}, lm=(1, 25))
P("Beatriz",  {"D": [2, 3, 4, 6, 8, 13, 14, 20, 22, 26]})
P("Bruna",    {"N": [7, 8, 10, 16], "D": [12]}, fe=(19, 31))
P("CaAbreu",  {"T": [1, 5, 6, 7, 8, 13, 15, 19, 20, 21, 23, 26, 27, 28, 29], "D": [2, 11, 12, 14, 25], "N": [31]})
P("Constantino", {"N": [4, 5, 7, 15, 17, 22, 24, 26, 29]})
P("Danielle", {"N": [1, 4, 7, 8, 11, 14, 15, 17, 18, 20, 22, 23, 28, 29]})
P("DebAlves2", {})  # (placeholder — DebAlves acima já com prefs novas)
P("DebMatias", {"D": [6, 7, 14, 18, 20, 24, 27, 28], "N": [16]})
P("Denise",   {"M": [1, 5, 8, 11, 12, 13, 20, 22, 26, 27, 29, 30], "T": [9], "N": [3, 14, 24]})
P("Ernesto",  {"D": [7, 14, 21, 28], "N": [9, 11, 23, 25]})
P("Fabiula",  {"N": [1, 2, 6, 7, 8, 13, 14, 18, 20, 22, 25, 27, 28, 30]})
P("Fernando", {"N": [5, 12, 19, 26], "M": [1, 3, 4, 7, 8, 10, 14, 15, 21, 22, 24, 28, 29, 31]})
P("Grayce",   {"N": [5, 9, 13, 27], "D": [8, 24, 25, 29]})
P("Heloa",    {"M": [1, 4, 6, 8, 9, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31], "N": [2], "T": [16, 23, 30]})
P("Iggor",    {"T": [3], "D": [7, 11, 14, 21, 26, 28], "M": [12, 18], "N": [23]})
P("IsaRibeiro", {"N": [1, 3, 4, 17, 21], "D": [6, 13, 27], "T": [7, 8], "M": [24, 25]})
P("Isabella", {"T": [1, 5, 13, 15, 19, 22, 26, 29], "N": [4, 12, 25], "M": [6, 10, 11, 20, 27], "D": [7, 14, 21, 28]})
P("Jaqueline", {"T": [3], "M": [4], "D": [6, 11, 13, 20, 22, 28, 30], "N": [16]})
P("Joaquim",  {"N": [3, 5, 9, 10, 12, 15, 19, 21, 26, 31]})
P("João",     {"D": [7, 21], "T": [8, 15, 25, 29], "N": [11, 14, 18, 23, 28]}, fe=(1, 5))
P("JuBrito",  {"M": [1, 10, 21, 22, 29], "D": [6, 11, 17, 20, 27], "N": [13, 30]})
P("JuCoutinho", {"T": [6, 13, 15, 20, 27, 29], "M": [7, 9, 14, 23, 24, 30], "N": [11, 16, 25], "D": [28]})
P("JuliaFig", {"N": [6, 11, 13, 19, 24, 26, 30]})
P("Kariny",   {"D": [1, 3, 4, 6, 8, 13, 15, 17, 19, 20, 22, 26, 27, 29]})
P("Kozak",    {"N": [1, 2, 22, 24, 29, 30]}, fe=(5, 19))
P("Laura",    {"M": [1, 3, 4, 5, 7, 9, 10, 12, 13, 14, 17, 18, 19, 21, 23, 24, 25, 26, 28, 31]})  # CHUTE
P("Leomara",  {"D": [2, 5, 10, 16, 19, 23, 26, 30], "M": [3, 12, 17]})
P("Leticia",  {"D": [6, 7, 15, 17, 20, 22, 27, 31]}, fe=(1, 5))
P("LeLemos",  {"D": [8, 19, 26, 29], "M": [10, 15, 16, 25, 30], "N": [11, 12, 23], "T": [14]}, fe=(1, 5))
P("LuAlice",  {"N": [1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31]})
P("LuCosta",  {"D": [3, 24], "N": [5, 9, 12, 14, 19, 26, 28]})
P("Marcia",   {"N": [2, 7, 14, 21, 28], "D": [11, 16, 19, 31]})
P("Marilia",  {"D": [3, 6, 10, 14, 19, 21, 27, 28], "M": [4, 7, 12, 20, 29], "N": [16]})
P("Mayana",   {"D": [1, 6, 8, 15, 20, 22, 27, 29], "M": [7, 9], "N": [3, 16, 17, 24, 31]})
P("MayWobido", {"N": [3, 7, 9, 10, 14, 21, 24, 28], "AB": [31]})
P("Melara",   {"N": [1, 6, 8, 13, 15, 20, 22, 30], "D": [4, 18, 25]})
P("Moabe",    {"D": [5, 8, 12, 15, 17, 19, 22, 26, 29]})  # CHUTE
P("Murilo2",  {})
P("Neyde",    {"N": [4, 6, 7, 11, 13, 14, 18]}, fe=(19, 31))
P("Nishioka", {"D": [3, 8, 17, 22, 31], "N": [6, 13, 20, 27]})
P("Patricia", {"D": [1, 8, 14, 15, 17, 21, 25, 29], "N": [2]})
P("Pedro",    {"N": [2, 6, 14, 16, 24, 25], "T": [5, 7, 26, 27, 30]})
P("Pjamile",  {"M": [1], "D": [2, 7, 9, 14, 17, 21, 23, 28, 31]})
P("Raphael",  {"N": [3, 5, 9, 15, 17, 19, 23, 26, 29]})
P("Raquel",   {"M": [1, 3, 27, 28, 31], "P": [20, 26], "N": [24], "T": [30]}, fe=(5, 19))
P("Raylander", {"N": [1, 8, 9, 12, 17, 19, 26], "D": [4, 11, 21, 30], "T": [15, 28]})
P("Ricardo",  {"M": [2, 5], "D": [3, 10, 16, 19], "N": [6, 13, 20, 27], "T": [15, 25, 29]})
P("Roberta",  {"T": [1, 8], "M": [2, 10], "N": [4, 6, 16, 18, 20, 25, 27], "D": [9, 13, 23, 29]})
P("Rosana",   {"N": [14, 21, 23, 28], "M": [16, 18, 20, 26, 27], "D": [17]}, fe=(1, 12))
P("Thamyres", {"T": [7, 10, 24, 28], "D": [9, 12, 23, 30], "N": [21]}, fe=(1, 5))
P("Vanessa",  {"M": [3, 4, 18, 29, 30], "D": [5, 7, 14, 16, 24, 28], "N": [21]})
P("Yuji",     {"M": [1, 2, 5, 6, 29, 30], "D": [4], "N": [7]}, lm=(9, 28))
P("Stephanie", {"A": [1, 2, 5, 6, 7, 8, 13, 14, 15, 16, 19, 20, 21, 22, 26, 27, 28, 29]})
P("JuIsaac",  {"A": [5, 7, 9, 14, 16, 19, 21, 23, 26, 28, 30]})
P("Jaqueline2", {})
del PLAN["DebAlves2"]; del PLAN["Murilo2"]; del PLAN["Jaqueline2"]

CHUTES = {"Laura", "Moabe"}
SEM_PREFS_ROTINA = {"Fred", "Milena", "Pabdo", "Janaina", "Stephanie", "JuIsaac"}

METAS = {  # CH semanal
    "Aline": 40, "DebAlves": 40, "MSalomão": 40, "Vinicius": 36, "Amelio": 36,
    "CaAbreu": 36, "Danielle": 36, "Fabiula": 36, "Isabella": 36, "JuBrito": 30,
    "Kariny": 36, "Mayana": 36, "Neyde": 36, "Roberta": 36, "LuAlice": 36,
    "Murilo": 36, "Amanda": 30, "Fernando": 30, "Janaina": 30, "João": 30,
    "JuCoutinho": 30, "LeLemos": 30, "Leomara": 24, "Marilia": 30,
    "Raylander": 30, "Ricardo": 30, "Rosana": 30, "AnaSeverino": 24, "Anna": 24,
    "Ariadne": 24, "Beatriz": 24, "Bruna": 24, "Constantino": 24,
    "DebMatias": 24, "Denise": 24, "Ernesto": 24, "Grayce": 24, "Heloa": 24,
    "Iggor": 24, "IsaRibeiro": 24, "Jaqueline": 24, "Joaquim": 24,
    "JuliaFig": 24, "Kozak": 24, "Laura": 24, "Leticia": 24, "LuCosta": 24,
    "Marcia": 24, "MayWobido": 24, "Melara": 24, "Moabe": 24, "Nishioka": 24,
    "Patricia": 24, "Pedro": 24, "Pjamile": 24, "Raphael": 24, "Raquel": 24,
    "Thamyres": 24, "Vanessa": 24, "Yuji": 24,
}
# cota fds nova (h/mês) já ajustada por férias
def cota_fds(ap):
    ch = METAS.get(ap, 0)
    fe_days = sum(1 for c in PLAN.get(ap, {}).values() if c in ("FE", "LM"))
    base = {36: 36, 30: 30, 24: 24, 40: 30}.get(ch, 0)
    if ap == "DebAlves": base = 24
    if ap == "Aline": base = 36
    if ap in ('Murilo',): return 24  # acordo dra Selma: fds 15/15 de 12h
    if ap in ('Ariadne',): return 0   # volta da LM em 26/10
    if ap in ('Janaina',): return 24  # padrão próprio dela (sáb 8-13h)
    if fe_days >= 10:
        return {36: 24, 30: 18, 24: 12, 40: 24}.get(ch, base)
    if fe_days >= 4:
        return {36: 30, 30: 24, 24: 18, 40: 30}.get(ch, base)
    return base

def report():
    print("== COBERTURA ==")
    ok = True
    for d in rng(1, 31):
        m = sum(1 for p in PLAN.values() if p.get(d) in CM)
        t = sum(1 for p in PLAN.values() if p.get(d) in CT)
        n = sum(1 for p in PLAN.values() if p.get(d) in CN)
        mm, mt, mn = mins(d)
        flags = []
        if m < mm: flags.append(f"M{m}<{mm}")
        if t < mt: flags.append(f"T{t}<{mt}")
        if n < mn: flags.append(f"N{n}<{mn}")
        if flags:
            ok = False
            tag = "FER" if d in FERIADO else ["seg","ter","qua","qui","sex","SÁB","DOM"][wd(d)]
            print(f"  {d:2d} {tag}: M{m}/{mm} T{t}/{mt} N{n}/{mn}  ⚠ {','.join(flags)}")
    if ok: print("  todos os dias ≥ mínimos ✓")

    print("== 18h INVERTIDO ==")
    bad = 0
    for ap, p in PLAN.items():
        for d in rng(1, 30):
            if p.get(d) == "N" and p.get(d + 1) in ("M", "D", "C", "J", "E", "P"):
                print(f"  ⚠ {ap}: {d}N → {d+1}{p[d+1]}"); bad += 1
    if not bad: print("  nenhum ✓")

    print("== CASAL Ariadne∦Raylander (mesmo turno) ==")
    a, r = PLAN["Ariadne"], PLAN["Raylander"]
    clash = [d for d in rng(26, 31)
             if a.get(d) and r.get(d) and a.get(d) not in ("FE","LM") and r.get(d) not in ("FE","LM")
             and ((a[d] in CN) == (r[d] in CN))]
    print(f"  choques: {clash or 'nenhum ✓'}")

    print("== HORAS vs META (só desvios >9h) e CH FDS vs COTA ==")
    for ap in sorted(METAS):
        p = PLAN.get(ap, {})
        tot = sum(HOURS.get(c, 0) for c in p.values())
        fe = sum(1 for c in p.values() if c in ("FE", "LM"))
        meta = METAS[ap] / 7 * (31 - fe)
        fds_h = sum(HOURS.get(c, 0) for d, c in p.items() if wd(d) >= 5 and c not in ("FE","LM","AB"))
        cq = cota_fds(ap)
        d1 = tot - meta
        msg = []
        if abs(d1) > 9: msg.append(f"CH {tot:.0f} vs {meta:.0f} ({d1:+.0f})")
        if fds_h < cq: msg.append(f"FDS {fds_h}h < cota {cq}h")
        if msg:
            chute = " (SEM PREFS)" if ap in CHUTES else ""
            print(f"  {ap:12s}{chute}: {' · '.join(msg)}")

report()

# ===================== CONVOCAÇÕES (Objetivo 01: completar) =================
# Impedimentos DUROS por pessoa: turnos permitidos por dia-da-semana + dias
# bloqueados. "não posso" sem motivo = duro (regra do Marcos, 18/08).
# fmt: {wd: "MTN"} (D permitido se M e T); dias bloqueados; flags.
W_ALL = {i: "MTN" for i in range(7)}
def wda(**kw):
    d = {i: kw.get("base", "") for i in range(7)}
    for k, v in kw.items():
        if k in ("seg","ter","qua","qui","sex","sab","dom"):
            d[["seg","ter","qua","qui","sex","sab","dom"].index(k)] = v
    return d

ALLOW = {
 # ap: (turnos por weekday, dias bloqueados, max N/semana [0=sem noturno], sem N consecutivas)
 "Roberta":   (W_ALL, {3, 7, 10, 12, 17, 21, 22, 24, 31}, 9, False),
 "IsaRibeiro":({i:("MN" if i in (0,2,4) else "MTN") for i in range(7)}, {10, 11}, 9, False),
 "Heloa":     (wda(ter="MT", qui="MT", sex="MT", sab="M", dom="M"), set(), 1, True),
 "JuCoutinho":(wda(seg="MT", ter="MT", qua="MTN", qui="MN", sab="MN", dom="MN"), {3, 4, 17, 18}, 2, True),
 "JuBrito":   (wda(ter="MT", qua="M", qui="MT", sex="M", sab="M", dom="MT"), {9, 12, 13, 22, 24, 25}, 1, True),
 "JuliaFig":  (wda(seg="MN", ter="MN"), {4, 9, 10, 17, 18, 31}, 2, False),
 "Ernesto":   (wda(qua="MT"), {12}, 0, True),
 "Grayce":    ({}, set(), 0, True),           # só o que ela listou
 "Marcia":    ({}, set(), 0, True),           # idem (marido viajando)
 "Iggor":     ({}, set(), 0, True),           # "não posso os outros"
 "Mayana":    ({}, set(), 0, True),
 "MayWobido": (wda(ter="TN", qui="TN", sex="TN", sab="TN", dom="TN"), {1,2,5,6,8,11,12,13,15,17,18,19,20,22,25,26,27,29,30,31}, 9, False),
 "Melara":    (wda(seg="TN", ter="TN", qua="TN", qui="TN", sex="TN", dom="MTN"), set(), 9, True),
 "Anna":      (wda(qua="MT", sex="M", sab="MTN", dom="MT"), {11, 17, 18, 25}, 2, True),
 "Beatriz":   (wda(seg="MT", ter="MT", qua="MT", qui="MT", sex="MT", sab="MT", dom="MT"), {1, 9, 15, 16, 17, 18, 27, 28, 29}, 0, True),
 "Denise":    (wda(seg="MN", ter="MN", qua="MN", qui="MN", sex="MN", sab="MN", dom="MN"), {2, 16, 17, 18}, 2, True),
 "AnaSeverino":(wda(seg="MN", ter="M", qua="M", qui="MN", sex="M", sab="MN", dom="MN"), {10, 11, 12, 28}, 2, True),
 "Constantino":(wda(seg="N", ter="N", qui="N", dom="N"), {10, 11, 12}, 2, True),
 "LuAlice":   (wda(seg="N", ter="N", qua="N", qui="N", sex="N", sab="N", dom="N"), {2, 30}, 3, False),
 "LuCosta":   (wda(seg="N", qua="N", sex="N", sab="MTN", dom="MTN"), {10, 11, 17, 18}, 3, True),
 "Danielle":  (wda(seg="N", ter="N", qua="N", qui="N", sex="N", sab="N", dom="N"), {3, 9, 10, 12, 31}, 9, False),
 "Fabiula":   (wda(ter="N", qua="N", qui="N", sex="N", sab="N", dom="N"), {4, 17, 31}, 9, False),
 "Pedro":     (wda(seg="TN", ter="TN", qua="TN", sex="TN", sab="TN", dom="TN"), {10, 11, 17, 18}, 9, False),
 "Raphael":   (wda(seg="TN", ter="TN", qua="TN", qui="TN", sex="TN", sab="MTN", dom="MTN"), set(), 9, False),
 "João":      (wda(ter="TN", qua="TN", qui="TN", sex="TN", dom="TN"), {6, 10, 13, 20, 24, 27, 30, 31}, 9, False),
 "Raylander": (wda(seg="N", ter="MTN", qua="MTN", qui="TN", sex="MTN", sab="MTN", dom="MTN"), {24, 25}, 9, False),
 "Ricardo":   (wda(seg="MTN", ter="MTN", qua="MTN", sex="TN", sab="MTN", dom="MTN"), {11, 18}, 1, True),
 "Nishioka":  (wda(seg="MTN", ter="MTN", qua="MTN", sex="TN", sab="MTN", dom="MTN"), {11, 15, 16, 18, 29, 30}, 1, True),
 "Vanessa":   (wda(seg="MT", ter="MT", qua="MT", qui="MT", sex="MT", sab="MT", dom="MT"), {1, 2, 6, 8, 11, 12, 13, 17, 20, 22, 23, 25, 26, 27}, 1, True),
 "Kariny":    (wda(seg="MT", ter="MT", qui="MT", sab="MT", dom="MT"), {9, 10, 11, 12, 18, 24, 25}, 0, True),
 "Leomara":   (wda(seg="MT", ter="M", qua="N", sex="MTN", sab="M"), {11, 18, 25}, 1, True),
 "Leticia":   (wda(ter="MT", qui="MT", qua="T", sab="MT", dom="MT"), {8, 9, 10, 11, 12, 13}, 0, True),
 "LeLemos":   (wda(seg="MTN", ter="MT", qua="MT", qui="MT", sex="MTN", sab="M", dom="MN"), {6, 7, 10, 17, 18, 20, 27, 31}, 2, True),
 "Patricia":  (wda(seg="MT", ter="MT", qua="MT", qui="MT", sex="MT", sab="MT", dom="MT"), {6, 9, 10, 13, 18, 20, 23, 24, 27}, 1, True),
 "Pjamile":   (wda(ter="M", qua="MTN", qui="M", sex="MT", sab="MT", dom="MT"), {10, 11, 25}, 1, True),
 "DebMatias": (wda(ter="MTN", qua="MT", sex="MT", sab="MT", dom="MT"), set(), 1, True),
 "Bruna":     (wda(seg="MTN", ter="MTN", qua="MTN", qui="MTN", sex="MTN", sab="MTN", dom="MTN"), {3, 4, 5, 9, 14, 17}, 9, False),
 "Isabella":  (wda(seg="TN", ter="MT", qua="T", qui="T", sab="M", dom="MN"), set(), 9, True),
 "Jaqueline": (wda(seg="MT", ter="MT", qua="MT", qui="MT", sex="MTN", sab="MT", dom="MT"), {12, 27}, 2, True),
 "Yuji":      (wda(seg="MN", ter="MN", qua="MN", qui="M", sex="M", dom="MTN"), set(), 2, True),
 "Fernando":  (wda(seg="MN", qua="M", qui="M", sex="MN", sab="M", dom="M"), {16, 17, 18}, 2, True),
 "Aline":     (W_ALL, {17, 18}, 9, False),
 "Amanda":    (wda(seg="MTN", ter="MT", qua="MT", qui="MT", sex="MTN", sab="MT", dom="MT"), {12, 17, 22, 24, 26}, 2, True),
 "Rosana":    (wda(seg="M", ter="M", qua="MN", qui="M", sex="M", sab="M", dom="M"), {13}, 2, True),
 "Thamyres":  (wda(qua="TN", sex="MT", sab="MT"), {13, 14, 15, 16, 17, 18}, 0, True),  # 1 N/mês já usada (21)
 "Joaquim":   (wda(seg="N", qui="N", sex="N", sab="N"), {1, 6, 7, 8, 11, 13, 14, 17, 18, 22, 23, 24, 25, 27, 28, 29}, 9, False),
 "Kozak":     (wda(qui="TN", sab="N"), {31}, 9, False),
 "Laura":     (wda(seg="M", ter="M", qua="M", qui="M", sex="M", sab="M", dom="M"), set(), 0, True),
 "Moabe":     (wda(seg="MT", qua="MT", qui="MT", sab="MT", dom="MT"), {3, 4}, 1, True),
 "Murilo":    (wda(seg="M", ter="M", qua="M", qui="M", sex="M", sab="MN", dom="MN"), set(), 2, True),
 "Marilia":   (wda(ter="MT", qua="MTN", qui="MT", sex="M", sab="MT", dom="M"), {5, 9, 22, 23, 24, 25}, 1, True),
}

CONVOC = []
def eligible(ap, d, shift):
    p = PLAN.get(ap, {})
    if d in p: return False
    if ap not in ALLOW: return False
    wdmap, blocked, maxn, noconsec = ALLOW[ap]
    if d in blocked: return False
    allowed = wdmap.get(wd(d), "")
    need = {"M": "M", "T": "T", "N": "N", "D": "MT"}[shift]
    if not all(x in allowed for x in need): return False
    # 18h invertido / vizinhança
    if shift == "N":
        if p.get(d + 1) in ("M", "D", "C", "J", "E", "P"): return False
        if noconsec and (p.get(d - 1) == "N" or p.get(d + 1) == "N"): return False
        wk = [x for x in range(d - 6, d + 7) if dt.date(2026, 10, min(max(x, 1), 31)).isocalendar()[1] == dt.date(2026, 10, d).isocalendar()[1] and 1 <= x <= 31]
        if sum(1 for x in wk if p.get(x) == "N") >= maxn: return False
    else:
        if p.get(d - 1) == "N": return False
    # casal
    if ap in ("Ariadne", "Raylander") and d >= 26:
        other = PLAN.get("Raylander" if ap == "Ariadne" else "Ariadne", {}).get(d)
        if other and ((other == "N") == (shift == "N")): return False
    return True

def saldo(ap):
    p = PLAN.get(ap, {})
    tot = sum(HOURS.get(c, 0) for c in p.values())
    fe = sum(1 for c in p.values() if c in ("FE", "LM"))
    return tot - METAS.get(ap, 0) / 7 * (31 - fe)

def fill():
    for _round in range(3):
        for d in rng(1, 31):
            for shift, group, idx in (("N", CN, 2), ("T", CT, 1), ("M", CM, 0)):
                while True:
                    have = sum(1 for p in PLAN.values() if p.get(d) in group)
                    need = mins(d)[idx]
                    if have >= need: break
                    cands = [ap for ap in METAS if eligible(ap, d, shift)]
                    if not cands and shift == "T":
                        cands = [ap for ap in METAS if eligible(ap, d, "D")]
                        if cands:
                            shift = "D"
                    if not cands:
                        break
                    nconv = {ap: sum(1 for c in CONVOC if c[0] == ap) for ap in cands}
                    cands.sort(key=lambda ap: (saldo(ap), nconv[ap]))
                    ap = cands[0]
                    PLAN[ap][d] = shift
                    CONVOC.append((ap, d, shift))

fill()
print("\n== CONVOCAÇÕES (fora das preferências, critério: menor CH → menos convocações) ==")
for ap, d, s in sorted(CONVOC, key=lambda x: (x[1], x[2])):
    print(f"  {d:2d}/{['seg','ter','qua','qui','sex','sáb','dom'][wd(d)]} {s}: {ap}  (saldo pós: {saldo(ap):+.0f}h)")
print(f"  total: {len(CONVOC)}")
print("\n== PÓS-CONVOCAÇÃO ==")
report()
