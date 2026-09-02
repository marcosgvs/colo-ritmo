#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validador de regras duras da escala — as que são lei, não preferência.

- art. 66 CLT: 11h de descanso entre jornadas (interjornada).
- 18h no mesmo dia / 18h invertido (noite emendando manhã) — casos extremos do art. 66.
- art. 67 CLT: DSR de 24h consecutivas por semana.
- adicional noturno: horas entre 22h e 05h (hora noturna vale 52min30s → fator 1,1428).

Roda tanto sobre o histórico importado do Senior quanto sobre um mês montado.
"""
import datetime as dt

from senior_import import CODIGOS

AUSENTE = {"FE", "LM", "AT", "AB"}
INTERJORNADA_MIN = 11.0
DSR_MAX_DIAS = 6

# letra -> (horas, ini, fim) — derivado da tabela de códigos, letra é a chave
JANELA = {}
for _cod, (_letra, _h, _i, _f) in CODIGOS.items():
    JANELA.setdefault(_letra, (_h, _i, _f))
JANELA.setdefault("CP", (6.0, 7.0, 13.0))     # cuidados paliativos (manhã)
JANELA.setdefault("CRO", (6.0, 13.0, 19.0))   # ambulatório CRO (tarde)


def _efetivo(letra):
    """códigos de banco de horas: M+ trabalha como M; M- não trabalha; Tm- = T."""
    if letra in ("M-", "T-", "D-", "N-"):
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


def _dtq(data, horas):
    return dt.datetime(data.year, data.month, data.day) + dt.timedelta(hours=horas)


def turnos_de(dias, pessoa):
    """lista ordenada de (data, letra, inicio, fim) da pessoa."""
    saida = []
    for data in sorted(dias):
        cel = dias[data].get(pessoa)
        if not cel:
            continue
        letra = _efetivo(cel[0] if isinstance(cel, tuple) else cel)
        if not letra or letra in AUSENTE or letra not in JANELA:
            continue
        _h, ini, fim = JANELA[letra]
        saida.append((data, letra, _dtq(data, ini), _dtq(data, fim)))
    return sorted(saida, key=lambda x: x[2])


def horas_noturnas(inicio, fim):
    """horas cravadas na janela 22h–05h."""
    total = 0.0
    cursor = inicio
    while cursor < fim:
        prox = min(fim, cursor + dt.timedelta(minutes=15))
        h = cursor.hour + cursor.minute / 60
        if h >= 22 or h < 5:
            total += (prox - cursor).total_seconds() / 3600
        cursor = prox
    return total


def auditar(dias, pessoas=None):
    achados = []
    pessoas = pessoas or sorted({p for d in dias.values() for p in d})
    for pessoa in pessoas:
        ts = turnos_de(dias, pessoa)
        for (d1, l1, i1, f1), (d2, l2, i2, f2) in zip(ts, ts[1:]):
            folga = (i2 - f1).total_seconds() / 3600
            if folga < 0:
                achados.append(dict(pessoa=pessoa, tipo="sobreposição", data=d1,
                                    detalhe=f"{l1} {d1:%d/%m} sobrepõe {l2} {d2:%d/%m}",
                                    horas=round(folga, 1), regra="art. 66 CLT"))
            elif folga < INTERJORNADA_MIN:
                soma = (f1 - i1).total_seconds() / 3600 + (f2 - i2).total_seconds() / 3600
                tipo = "18h no mesmo dia" if d1 == d2 else (
                       "18h invertido" if l1 in ("N", "NT") else "interjornada")
                achados.append(dict(pessoa=pessoa, tipo=tipo, data=d1,
                                    detalhe=f"{l1} {d1:%d/%m} → {l2} {d2:%d/%m}: "
                                            f"{folga:.0f}h de descanso (soma {soma:.0f}h)",
                                    horas=round(folga, 1), regra="art. 66 CLT — 11h"))
        # DSR (art. 67): precisa existir uma folga de 24h consecutivas em cada
        # janela de 7 dias. Contar "dias seguidos" não serve: quem faz 6h de manhã
        # todo dia tem folga de 18h entre turnos e nunca chega a 24h.
        if ts:
            inicio, ultimo = ts[0][2].date(), ts[-1][3].date()
            janela = inicio
            while janela <= ultimo:
                fim_janela = janela + dt.timedelta(days=7)
                dentro = [t for t in ts if janela <= t[2].date() < fim_janela]
                if len(dentro) >= 6:
                    folgas = [(b[2] - a[3]).total_seconds() / 3600
                              for a, b in zip(dentro, dentro[1:])]
                    maior = max(folgas) if folgas else 999
                    if maior < 24:
                        achados.append(dict(pessoa=pessoa, tipo="DSR", data=janela,
                                            detalhe=f"semana de {janela:%d/%m}: "
                                                    f"{len(dentro)} turnos, maior folga "
                                                    f"{maior:.0f}h (mínimo 24h)",
                                            horas=round(maior, 1),
                                            regra="art. 67 CLT — 24h consecutivas/semana"))
                janela += dt.timedelta(days=7)

    return sorted(achados, key=lambda a: (a["data"], a["pessoa"]))


def noturnas_por_mes(dias, pessoas=None):
    """{(pessoa, mes): horas noturnas} — insumo do adicional noturno."""
    pessoas = pessoas or sorted({p for d in dias.values() for p in d})
    saida = {}
    for pessoa in pessoas:
        for data, letra, i, f in turnos_de(dias, pessoa):
            hn = horas_noturnas(i, f)
            if hn:
                saida[(pessoa, data.month)] = saida.get((pessoa, data.month), 0.0) + hn
    return saida


if __name__ == "__main__":
    from collections import Counter
    from senior_import import importar
    DIAS, _ = importar()
    achados = auditar(DIAS)
    print(f"=== AUDITORIA DO HISTÓRICO REAL (fev–set/2026, 183 dias) ===")
    print(f"achados: {len(achados)}\n")
    for tipo, n in Counter(a["tipo"] for a in achados).most_common():
        print(f"  {tipo:20s} {n}")
    print()
    for tipo in ("sobreposição", "18h no mesmo dia", "18h invertido", "interjornada", "DSR"):
        do_tipo = [a for a in achados if a["tipo"] == tipo]
        if not do_tipo:
            continue
        print(f"--- {tipo} ({len(do_tipo)}) ---")
        for a in do_tipo[:18]:
            print(f"   {a['pessoa']:14s} {a['detalhe']}")
        if len(do_tipo) > 18:
            print(f"   ... +{len(do_tipo)-18}")
        print()
    piores = Counter(a["pessoa"] for a in achados).most_common(12)
    print("--- quem mais aparece ---")
    for p, n in piores:
        print(f"   {p:14s} {n}")
