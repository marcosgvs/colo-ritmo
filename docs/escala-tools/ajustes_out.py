#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Política do feriado 12/10 — quem da rotina entra, quem folga, e por quê.

ENTENDIMENTO CORRIGIDO PELO MARCOS (18/08/26): a MSalomão pediu a manhã do
feriado livre SÓ PARA ELA, não para os rotineiros como grupo. A leitura anterior
("rotineiros folgam a manhã do feriado") estava errada. Com isso, o resto da
rotina volta a ser elegível — que é o padrão do ano: nos SETE feriados de 2026
até setembro a rotina trabalhou a manhã (4 a 6 pessoas), sem aprovação especial,
porque é assim que o serviço funciona.

Quem executa é o remontar_fds.py (fase 2); este arquivo é a política com o
motivo por escrito, que a aba CONVOCAÇÕES mostra.
"""

# rotina escalada na manhã do feriado — critério do doc §3.4:
# a folga do feriado é de quem já fez todos; trabalha quem menos fez.
# Contagem 2026: Fred 7/7 · Murilo 6/7 · MSalomão/DebAlves/Milena 5/7 ·
# Amelio 3/7 · Pabdo 1/7. (Vinicius 4/7, mas está de férias.)
AJUSTES = [
    ("Pabdo",  12, "M", "feriado 12/10: fez 1 de 7 feriados em 2026 — é quem mais "
                        "deve feriado na rotina (critério do doc §3.4)"),
    ("Amelio", 12, "M", "feriado 12/10: fez 3 de 7 · manhã respeita o atestado que "
                        "o proíbe de noturnos"),
    ("Milena", 12, "M", "feriado 12/10: fez 5 de 7 · rotina de manhã, como nos "
                        "outros sete feriados do ano"),
    ("Murilo", 12, "M", "feriado 12/10: fez 6 de 7 · manhã é a rotina onco dele"),
]

# quem da rotina FOLGA o feriado, e por qual critério
FOLGAS = [
    ("MSalomão", "PEDIDO INDIVIDUAL atendido — ela pediu a manhã do feriado livre "
                 "para si (entendimento corrigido em 18/08: o pedido nunca foi para "
                 "o grupo)"),
    ("Fred",     "fez os 7 feriados de 2026 — pelo critério do doc §3.4, a "
                 "prioridade de folga é dele"),
    ("DebAlves", "bloqueio 42/42/36 (AV 2:1): 6h a mais nesta semana quebrariam a "
                 "alternância"),
    ("Vinicius", "férias 12–26/10"),
]

NAO_FEITO = [
    ("Pedido da MSalomão",
     "ATENDIDO — e só dela",
     "A leitura anterior ('rotineiros folgam a manhã do feriado') estava errada e "
     "foi corrigida pelo Marcos em 18/08: o pedido era individual. A folga dela "
     "está garantida; os demais rotineiros seguem o padrão dos sete feriados "
     "anteriores do ano, que sempre teve a rotina na manhã."),
    ("Aprovação da dra. Selma",
     "NÃO NECESSÁRIA",
     "Escalar a rotina na manhã do feriado é o padrão de todos os 7 feriados de "
     "2026 — nunca dependeu de aprovação especial. O que teria exigido a dra. "
     "Selma (§4) era hora extra fora do padrão para quem tinha pedido folga; com "
     "o entendimento corrigido, ninguém que pediu folga está escalado."),
    ("Preferências atropeladas neste ajuste",
     "4 pessoas",
     "Pabdo, Amelio, Milena e Murilo entraram no feriado sem terem pedido — como "
     "nos outros feriados do ano. Geram CRÉDITO na contagem anual de feriados "
     "(aba FERIADO), que é exatamente o critério que os escolheu: quem menos fez, "
     "faz; quem já fez todos, folga."),
]

# mantido por compatibilidade com quem lia o aviso antigo
APROVACAO = {
    "instancia": "dra. Selma",
    "status": "não necessária — padrão do ano",
    "enquanto_nao_aprovar": "",
}


def aplicar(PLAN):
    """aplica as 4 linhas da rotina (a checagem de descanso/teto é do remontar)."""
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
    _, feitas = aplicar(ns["PLAN"])
    for ap, dia, letra, antes, _m in feitas:
        print(f"  {ap:10s} {dia:02d}/10  {antes or 'livre'} → {letra}")
