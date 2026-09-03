#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Setembro/2026 CORRIGIDO PELA MARI — lido do Sheet dela ("V5") em 03/09/26.

Ela digitou estes valores nas colunas de véspera da aba OUT (28–30/09), por cima das
fórmulas que buscavam a aba SET. Marcos, 03/09: "a verdade é a dela".

Por que isto existe como módulo: a véspera na OUT é FÓRMULA da aba SET. Enquanto a
correção vivia só na célula digitada, ela era um valor solto — a próxima geração da
planilha devolveria a fórmula e apagaria o que ela sabe. Aplicando aqui, setembro passa
a nascer certo e a véspera volta a ser fórmula viva mostrando o valor dela.

A grade do grupo (fonte de setembro) não sabia destes nove casos: ela lista nomes por
turno e não registra licença nem quem entrou de última hora.
"""

# (apelido, dia de setembro): código
CORRECOES = {
    # o 47 (10h de chefia) do Fred não valeu nesse dia — foi manhã de 6h
    ("Fred", 28): "M",
    # trabalhou a manhã de 28/09; a grade não a listava
    ("MSalomão", 28): "M",
    # a noite foi no dia 28 e o CEP no dia 29 (a grade tinha o CEP no 28 e nada no 29).
    # Consequência real, que ela conhece: N 28 → CEP 29 é jornada de 16h com 1h de
    # descanso — o alerta 18h⚠ da planilha passa a mostrar isso
    ("Aline", 28): "N",
    ("Aline", 29): "CEP",
    # licença até o fim do mês: a grade omite quem está de licença
    ("Ariadne", 29): "LM",
    ("Ariadne", 30): "LM",
    ("Jaqueline", 29): "LM",
    ("Jaqueline", 30): "LM",
    # administrativo (código 11) no dia 30
    ("MPinheiro", 30): "A",
}

NOTA = ("Nove células de 28–30/09 corrigidas pela escalista no Sheet dela (03/09/26) e trazidas "
        "para cá: a versão dela é a fonte de verdade. A grade do grupo não registra licença nem "
        "troca de última hora, e é por isso que ela precisou corrigir.")


def aplicar(DIAS):
    """sobrepõe as correções em DIAS[date][apelido] = (letra, origem)."""
    import datetime as dt
    for (apelido, dia), letra in CORRECOES.items():
        DIAS.setdefault(dt.date(2026, 9, dia), {})[apelido] = (letra, "mari")
    return len(CORRECOES)
