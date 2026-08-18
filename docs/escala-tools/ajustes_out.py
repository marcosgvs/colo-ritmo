#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ajustes sobre o PLAN de outubro, com o motivo colado em cada linha.

Camada separada de propósito: o plano do escala_out_v3.py fica intacto e cada
mudança posterior carrega por escrito quem entrou, onde e por qual critério —
é isso que a escalista precisa poder mostrar a quem perguntar.

Decisão do Marcos (17/08/26): "preferência não é lei, é uma sugestão. Se não der,
não deu e o médico se vira pra trocar. A ideia é evitar, mas se não der, tá tudo bem."
"""

# (apelido, dia, letra, motivo público)
AJUSTES = [
    # ---------------- feriado 12/10 · N. Sra. Aparecida (segunda) ----------------
    # O plano original deu folga à rotina inteira e baixou o alvo para o mínimo de
    # domingo. Nos SETE feriados anteriores de 2026 a rotina trabalhou a manhã (4 a
    # 6 pessoas) e a lotação ficou em 15 a 20 — o feriado escala como o dia da
    # semana em que cai e não reduz a lotação exigida. Voltando ao padrão do ano.
    #
    # Quem da rotina trabalha: critério do doc §3.4 — a folga do feriado é de quem
    # já fez todos. Fred (7/7 feriados em 2026) e Murilo... ver abaixo.
    ("Pabdo",  12, "M", "feriado 12/10: fez 1 de 7 feriados em 2026, é quem mais deve "
                        "feriado na rotina — critério do doc §3.4 (folga vai pra quem já fez todos)"),
    ("Amelio", 12, "M", "feriado 12/10: fez 3 de 7 feriados em 2026 · manhã respeita o "
                        "atestado que a proíbe de noturnos"),
    ("Milena", 12, "M", "feriado 12/10: fez 5 de 7 · rotina de manhã, como nos outros feriados"),
    ("Murilo", 12, "M", "feriado 12/10: fez 6 de 7 · manhã é a rotina onco dele, sem "
                        "mudança de padrão"),
    ("Grayce", 12, "D", "feriado 12/10: 12h cobre manhã E tarde de uma vez, e ela pediu "
                        "para não receber 6h avulsas (preferir 12h) — pedido atendido. "
                        "Era quem mais devia horas entre os livres: -10h"),
    ("Marcia", 12, "T", "feriado 12/10: segunda é o dia dela ('completa com seg dia') e "
                        "estava a +2h da meta, o menor saldo entre os elegíveis à tarde"),
    # Fred (7/7) e MSalomão/DebAlves ficam FORA de propósito: Fred já fez todos os
    # feriados do ano e é dele a prioridade de folga; MSalomão e DebAlves têm o
    # bloqueio 42/42/36 ("AV 2:1"), que 6h a mais na semana quebraria.
]

# o que NÃO foi feito, e por quê — a outra metade da prestação de contas
NAO_FEITO = [
    ("MSalomão pediu que a rotina folgasse a manhã do feriado 12/10",
     "PEDIDO NÃO ATENDIDO",
     "Nos sete feriados anteriores de 2026 a rotina trabalhou a manhã (4 a 6 pessoas) "
     "e a lotação ficou em 15 a 20. Atender o pedido deixaria 12/10 com 9 de manhã, "
     "contra 14 exigidos numa segunda — o feriado escala como o dia da semana em que "
     "cai e não reduz a lotação. A folga foi para quem o próprio critério do serviço "
     "indica: Fred, que fez todos os 7 feriados do ano. MSalomão e DebAlves também "
     "folgam, por causa do bloqueio 42/42/36."),
    ("Preferências atropeladas neste ajuste",
     "6 pessoas",
     "Pabdo, Amelio, Milena, Murilo, Grayce e Marcia entraram no feriado sem terem "
     "pedido. Todas geram CRÉDITO em novembro: prioridade na hora de conceder "
     "preferência. Quem não puder, negocia troca — e a troca é legítima."),
]


def aplicar(PLAN):
    """devolve (PLAN ajustado, lista de mudanças aplicadas)."""
    feitas = []
    for apelido, dia, letra, motivo in AJUSTES:
        antes = PLAN.get(apelido, {}).get(dia)
        if antes == letra:
            continue
        PLAN.setdefault(apelido, {})[dia] = letra
        feitas.append((apelido, dia, letra, antes, motivo))
    return PLAN, feitas


if __name__ == "__main__":
    import runpy
    ns = runpy.run_path("escala_out_v3.py")
    PLAN, feitas = aplicar(ns["PLAN"])
    print(f"{len(feitas)} ajustes aplicados:")
    for ap, dia, letra, antes, _m in feitas:
        print(f"  {ap:12s} {dia:02d}/10  {antes or 'livre'} → {letra}")
