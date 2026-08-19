#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Redistribui os fins de semana de outubro e refaz o feriado na ordem certa.

DICA DO MARCOS (17/08/26), que aqui é algoritmo e não só texto:
    "Começa sempre pelos fds, preenche e deixa o mais justo.
     Depois vai pra feriado e aí o restante da semana."

Fase 1 · FDS      — transferir plantão de fim de semana de quem está ACIMA da cota
                    para quem está ABAIXO. Transferência, não remontagem: o slot
                    troca de dono, então a cobertura não muda e a justiça só melhora.
Fase 2 · FERIADO  — 12/10 sem a rotina (a MSalomão pediu folga e o pedido vale),
                    preenchido por plantonistas até 14/10/7.
Fase 3 · SEMANA   — conferir o resto e tapar o que sobrou.

Reusa o ALLOW e o eligible() do escala_out_v3.py: impedimento duro declarado é
intocável, e é a única coisa que não se negocia aqui.
"""
import datetime as dt
import os
import runpy
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

NS = runpy.run_path(os.path.join(AQUI, "escala_out_v3.py"))
PLAN = NS["PLAN"]
HOURS, METAS, mins, wd = NS["HOURS"], NS["METAS"], NS["mins"], NS["wd"]
CM, CT, CN = NS["CM"], NS["CT"], NS["CN"]
eligible, cota_fds = NS["eligible"], NS["cota_fds"]

FERIADO = 12
DIAS_FDS = [d for d in range(1, 32) if wd(d) >= 5]
# quem nunca RECEBE plantão de redistribuição (rotina + Janaina, que tem padrão próprio)
ROTINA = {"Fred", "Milena", "Pabdo", "MSalomão", "DebAlves", "Vinicius", "Amelio",
          "Murilo", "Janaina"}
# REGRA DA ROTINA (Marcos, 18/08/26): dias úteis apenas pela manhã · nunca fim de
# semana. Revoga o rodízio 15/15 MSalomão↔Vinicius, o sábado noturno 15/15 do
# Murilo, o bloqueio 42/42/36 e as tardes de completude da DebAlves. O feriado
# segue a política própria (contagem anual, ajustes_out). Janaina NÃO é rotina:
# o contrato dela é seg–sáb 8–13h e a 10ª manhã de sábado é dela por regra.
ROTINA_REGRA = {"Fred", "Milena", "Pabdo", "MSalomão", "DebAlves", "Vinicius",
                "Amelio", "Murilo"}
# ausência real não codificada no plano (BHN): não preencher estes dias
AUSENTE_ROTINA = {"Amelio": set(range(24, 32))}

# ------------------------------------------------------------ remontagem completa
# (Marcos, 18/08/26: "vamos repreencher tudo utilizando essas novas informações")
CONVOC_ANTIGAS = NS["CONVOC"]

# compromissos das fichas de setembro: horas mínimas na S1 parcial (01–04)
S1_METAS = {"Danielle": 24, "Fabiula": 12, "JuBrito": 12, "Leomara": 24,
            "Heloa": 24, "Pedro": 24, "Raylander": 30}
# Ernesto (→24h) fica FORA de propósito: a paridade 15/15 autoral dele é
# fds 09/11 e 23/25, e a S1 não tem quarta — o compromisso não é executável
# dentro das janelas declaradas. Vai como pendência nomeada para a Mari.
NOVAS = []            # todas as convocações da remontagem: (ap, dia, turno, fase)


def despir_convocacoes(verbose=True):
    """volta o plano à base autoral pura: remove as 48 convocações antigas,
    feitas sob as regras velhas (rotina contava em fds e tarde)."""
    n = 0
    for ap, d, turno in CONVOC_ANTIGAS:
        if PLAN.get(ap, {}).get(d) == turno:
            del PLAN[ap][d]
            n += 1
    if verbose:
        print(f"REMONTAGEM · {n} convocações antigas removidas — base autoral pura")
    return n


def fase0b_setembro(verbose=True):
    """compromissos das fichas de setembro na S1 parcial (01–04) + teto legal.

    A preferência autoral também obedece à lei: quem estourar CH+10h na semana
    perde o excedente (caso Fabiula: 4 noites autorais na semana 1 = 48h > 46h).
    """
    mov, pendencias = [], []
    # teto sobre a base autoral
    for ap in list(PLAN):
        if ap in ROTINA_REGRA:
            continue
        ch = METAS.get(ap, 0)
        if not ch:
            continue
        for ini, fim in SEMANAS:
            for _v in range(6):
                h = sum(HOURS.get(l, 0) for d, l in PLAN[ap].items()
                        if ini <= d <= fim and l in TRANSFERIVEL)
                if h <= TETO_CONSTITUCIONAL:
                    break
                # tira o turno mais tardio da semana que não seja compromisso de S1
                cands = sorted((d for d, l in PLAN[ap].items()
                                if ini <= d <= fim and l in TRANSFERIVEL), reverse=True)
                alvo_s1 = S1_METAS.get(ap, 0)
                for d in cands:
                    h_s1 = sum(HOURS.get(l, 0) for dd, l in PLAN[ap].items() if dd <= 4)
                    if d <= 4 and h_s1 - HOURS.get(PLAN[ap][d], 0) < alvo_s1:
                        continue
                    mov.append((ap, d, PLAN[ap][d], "teto: semana autoral acima de 44h"))
                    del PLAN[ap][d]
                    break
                else:
                    break
    # completar S1 até a meta, dentro das janelas
    for ap, meta in S1_METAS.items():
        for _v in range(4):
            h = sum(HOURS.get(l, 0) for d, l in PLAN.get(ap, {}).items() if d <= 4)
            if h >= meta:
                break
            feito = False
            for d in (1, 2, 3, 4):
                if d in PLAN.get(ap, {}):
                    continue
                for turno in ("N", "D", "M", "T"):
                    if (turno in TRANSFERIVEL and eligible(ap, d, turno)
                            and descanso_ok(ap, d, turno) and teto_ok(ap, d, turno)):
                        PLAN[ap][d] = turno
                        NOVAS.append((ap, d, turno, "compromisso de setembro"))
                        feito = True
                        break
                if feito:
                    break
            if not feito:
                pendencias.append((ap, meta, h))
                break
    if verbose:
        print(f"FASE 0b · setembro: {sum(1 for x in NOVAS if x[3]=='compromisso de setembro')} "
              f"encaixes de S1 · {len(mov)} cortes por teto legal")
        for ap, d, l, m in mov:
            print(f"   corte: {ap} {d:02d}/10 {l} — {m}")
        for ap, meta, h in pendencias:
            print(f"   ⚠ pendência: {ap} S1 em {h}h, meta {meta}h — sem slot elegível")
    return mov, pendencias
AUSENTE = {"FE", "LM"}
# só estes são transferíveis. J (5h Janaina), E (CEP), C (10h chefia), A
# (administrativo), P (paliativo), R (CRO) e AB (abono de aniversário) são
# estruturais ou pessoais: passar pra outra pessoa não faz sentido — e foi
# tentar transferir um AB que estourou o eligible().
TRANSFERIVEL = {"M", "T", "D", "N", "NT"}
# janela de cada turno, para checar interjornada de 11h
JANELA = {"M": (7, 13), "T": (13, 19), "D": (7, 19), "N": (19, 31), "NT": (19, 25),
          "C": (8, 19), "J": (8, 13), "E": (8, 12), "A": (8, 17), "P": (7, 13), "R": (13, 19)}


def horas_fds(ap):
    return sum(HOURS.get(l, 0) for d, l in PLAN.get(ap, {}).items() if d in DIAS_FDS)


# Outubro tem 5 SÁBADOS. A demanda de fds pelo mínimo é 1704h e a soma de todas
# as cotas do grupo é 1494h: faltam 210h que não têm de onde sair. A cota não fecha
# por aritmética, não por má distribuição — então "deixar o mais justo" não é levar
# todos à cota (impossível), é espalhar o excesso inevitável EM PROPORÇÃO à cota
# de cada um. Quem tem cota de 36h absorve mais que quem tem 24h.
def _fator_excesso():
    demanda = sum((10*6 + 8*6 + 7*12) if wd(d) == 5 else (9*6 + 8*6 + 7*12)
                  for d in DIAS_FDS)
    # a rotina saiu do fim de semana (regra 18/08): a oferta é só dos plantonistas
    oferta = sum(cota_fds(a) for a in PLAN if a not in ROTINA_REGRA)
    return max(1.0, demanda / oferta) if oferta else 1.0


FATOR = _fator_excesso()


def alvo_fds(ap):
    """cota + a fatia proporcional do excesso que o mês obriga. Rotina: zero."""
    if ap in ROTINA_REGRA:
        return 0
    c = cota_fds(ap)
    return c * FATOR if c else 0


def injusticas():
    """soma dos desvios em relação ao ALVO proporcional — o que queremos reduzir."""
    return sum(abs(horas_fds(ap) - alvo_fds(ap)) for ap in PLAN if cota_fds(ap))


def descanso_ok(ap, dia, turno):
    """11h entre jornadas (art. 66), olhando o dia anterior e o seguinte."""
    ini, fim = JANELA[turno]
    for viz, sinal in ((dia - 1, -1), (dia + 1, +1)):
        outro = PLAN.get(ap, {}).get(viz)
        if not outro or outro in AUSENTE or outro not in JANELA:
            continue
        oi, of = JANELA[outro]
        if sinal < 0:                       # vizinho termina antes de este começar
            folga = (ini + 24) - of
        else:                               # este termina antes do vizinho começar
            folga = (oi + 24) - fim
        if folga < 11:
            return False
    return True


SEMANAS = [(1, 7), (8, 14), (15, 21), (22, 28), (29, 31)]
# Teto semanal = SÓ o constitucional (art. 7º XIII). O "CH+10h" da 1ª versão
# aplicava o art. 59 (2h extra/dia) a plantão 12x36, o que não corresponde: em
# regime de plantão, semana de 36h com CH de 24h é prática normal, compensada
# no banco — o corte por CH+10h chegou a propor 50 cortes em preferências
# autorais, o que é errado. 44h é a linha dura; o resto é contabilidade mensal.
TETO_CONSTITUCIONAL = 44


def horas_semana(ap, dia):
    ini, fim = next(w for w in SEMANAS if w[0] <= dia <= w[1])
    return sum(HOURS.get(l, 0) for d, l in PLAN.get(ap, {}).items() if ini <= d <= fim)


def teto_ok(ap, dia, turno):
    """não criar semana acima de 44h — o mês pode fechar e a semana estourar."""
    return horas_semana(ap, dia) + HOURS.get(turno, 0) <= TETO_CONSTITUCIONAL


def pode_receber(ap, dia, turno):
    if ap in ROTINA or ap not in PLAN:
        return False
    if dia in PLAN[ap]:                      # já tem algo nesse dia
        return False
    if any(PLAN[ap].get(d) in AUSENTE for d in (dia,)):
        return False
    if turno not in TRANSFERIVEL or not eligible(ap, dia, turno):
        return False
    if not descanso_ok(ap, dia, turno):
        return False
    if not teto_ok(ap, dia, turno):
        return False
    # não estourar a própria cota ao receber
    alvo = alvo_fds(ap)
    if alvo and dia in DIAS_FDS and horas_fds(ap) + HOURS.get(turno, 0) > alvo + 6:
        return False
    return True


def fase0_rotina(verbose=True):
    """aplica a regra da rotina: dia útil só manhã, fim de semana nunca."""
    mov = {"removidos": [], "convertidos": [], "preenchidos": []}
    for ap in ROTINA_REGRA:
        pd = PLAN.get(ap, {})
        for d in sorted(pd):
            l = pd[d]
            if l in AUSENTE or d == FERIADO:
                continue
            if wd(d) >= 5:
                del pd[d]
                mov["removidos"].append((ap, d, l))
            elif l != "M":
                pd[d] = "M"
                mov["convertidos"].append((ap, d, l))
        for d in range(1, 32):
            if wd(d) >= 5 or d == FERIADO or d in pd:
                continue
            if d in AUSENTE_ROTINA.get(ap, set()):
                continue
            pd[d] = "M"
            mov["preenchidos"].append((ap, d))
    if verbose:
        print(f"FASE 0 · regra da rotina: {len(mov['removidos'])} fds removidos · "
              f"{len(mov['convertidos'])} convertidos p/ manhã · "
              f"{len(mov['preenchidos'])} dias úteis completados")
    return mov


def fase1a_preencher_fds(verbose=True):
    """tapa os buracos de fim de semana que a saída da rotina abriu.

    Duas rodadas: primeiro respeitando o alvo proporcional de cota; se sobrar
    buraco, cobertura ganha de cota (hierarquia A1) e o alvo é ignorado — mas
    elegibilidade, descanso e teto da CLT nunca são.
    """
    postos, sem_gente = [], []
    for rodada in ("estrita", "relaxada"):
        for dia in DIAS_FDS:
            for _v in range(20):
                m, t, n = cobertura(dia)
                alvo = mins(dia)
                faltas = [(x, q) for x, q in
                          (("M", alvo[0]-m), ("T", alvo[1]-t), ("N", alvo[2]-n)) if q > 0]
                if not faltas:
                    break
                turno = faltas[0][0]
                cands = []
                for ap in PLAN:
                    if rodada == "estrita":
                        ok = pode_receber(ap, dia, turno)
                    else:
                        ok = (ap not in ROTINA and dia not in PLAN.get(ap, {})
                              and turno in TRANSFERIVEL and eligible(ap, dia, turno)
                              and descanso_ok(ap, dia, turno) and teto_ok(ap, dia, turno))
                    if ok:
                        cands.append((horas_fds(ap) - alvo_fds(ap), ap))
                if not cands:
                    if rodada == "relaxada":
                        sem_gente.append((dia, turno))
                    break
                cands.sort()
                PLAN[cands[0][1]][dia] = turno
                postos.append((cands[0][1], dia, turno, rodada))
                NOVAS.append((cands[0][1], dia, turno, "fim de semana"))
    if verbose:
        print(f"FASE 1a · fds preenchido: {len(postos)} encaixes "
              f"({sum(1 for x in postos if x[3]=='relaxada')} acima do alvo de cota, "
              f"porque cobertura ganha de cota)")
        for ap, d, t, r in postos:
            print(f"   {d:02d}/10 {t}: {ap}{' *' if r=='relaxada' else ''}")
        for d, t in sem_gente:
            print(f"   ⚠ {d:02d}/10 {t}: SEM candidato elegível — buraco real")
    return postos, sem_gente


def fase1_fds(verbose=True):
    """transfere fds de quem está acima para quem está abaixo da cota."""
    movidos = []
    for _volta in range(400):
        acima = sorted(((horas_fds(a) - alvo_fds(a), a) for a in PLAN
                        if cota_fds(a) and horas_fds(a) > alvo_fds(a) + 6), reverse=True)
        if not acima:
            break
        melhorou = False
        for _exc, doador in acima:
            for dia in sorted(DIAS_FDS):
                turno = PLAN[doador].get(dia)
                if turno not in TRANSFERIVEL:
                    continue
                # candidatos: quem está mais abaixo da própria cota primeiro
                abaixo = sorted((horas_fds(a) - alvo_fds(a), a) for a in PLAN
                                if cota_fds(a) and horas_fds(a) < alvo_fds(a))
                for _falta, recebedor in abaixo:
                    if pode_receber(recebedor, dia, turno):
                        antes = injusticas()
                        del PLAN[doador][dia]
                        PLAN[recebedor][dia] = turno
                        if injusticas() < antes:
                            movidos.append((doador, recebedor, dia, turno))
                            melhorou = True
                            break
                        PLAN[recebedor].pop(dia, None)   # desfaz
                        PLAN[doador][dia] = turno
                if melhorou:
                    break
            if melhorou:
                break
        if not melhorou:
            break
    if verbose:
        print(f"FASE 1 · fds: {len(movidos)} transferências")
        for do, para, dia, t in movidos:
            print(f"   {dia:02d}/10 {t}: {do} → {para}")
    return movidos


def cobertura(dia):
    m = t = n = 0
    for ap, por in PLAN.items():
        l = por.get(dia)
        if not l:
            continue
        m += l in CM
        t += l in CT
        n += l in CN
    return m, t, n


def estender_para_dia(dia, verbose=True):
    """quem já faz 6h nesse dia e pode fazer 12h vira D — enche o turno que falta
    sem chamar mais ninguém. Foi assim que a Grayce resolveu manhã e tarde de uma vez."""
    feitos = []
    for ap, por in PLAN.items():
        if ap in ROTINA:
            continue
        if por.get(dia) != "M":
            continue
        if not eligible(ap, dia, "D") or not descanso_ok(ap, dia, "D"):
            continue
        por[dia] = "D"
        feitos.append(ap)
        if verbose:
            print(f"   {ap}: M → D (12h cobre a tarde também)")
        m, t, n = cobertura(dia)
        if t >= (10 if dia == FERIADO else mins(dia)[1]):
            break
    return feitos


def fase2_feriado(verbose=True):
    """12/10: primeiro a rotina pelo padrão do ano, depois plantonistas.

    Entendimento corrigido em 18/08/26: a folga da manhã do feriado é pedido
    INDIVIDUAL da MSalomão — o resto da rotina segue o padrão dos sete feriados
    de 2026 (rotina na manhã, 4 a 6 pessoas). A política, com o motivo de cada
    linha e de cada folga, vive em ajustes_out.py.

    Cada turno é tentado de forma independente: se a manhã não tem candidato,
    isso não pode impedir a tarde de ser resolvida (era o bug da primeira versão).
    """
    import ajustes_out
    postos, impossivel = [], []
    alvo = (14, 10, 7)
    for apelido, dia, letra, _motivo in ajustes_out.AJUSTES:
        if dia != FERIADO or PLAN.get(apelido, {}).get(dia):
            continue
        if any(PLAN[apelido].get(d) in AUSENTE for d in (dia,)):
            continue
        if not descanso_ok(apelido, dia, letra) or not teto_ok(apelido, dia, letra):
            if verbose:
                print(f"   ⚠ {apelido} barrado pela CLT (descanso/teto) — não escalado")
            continue
        PLAN[apelido][dia] = letra
        postos.append((apelido, letra))
    for turno, idx in (("T", 1), ("M", 0), ("N", 2)):
        for _v in range(30):
            atual = cobertura(FERIADO)
            falta = alvo[idx] - atual[idx]
            if falta <= 0:
                break
            if turno == "T" and estender_para_dia(FERIADO, verbose):
                continue
            cands = sorted((sum(HOURS.get(l, 0) for l in PLAN[a].values())
                            - METAS.get(a, 0) * 31 / 7, a) for a in PLAN
                           if pode_receber(a, FERIADO, turno))
            if not cands:
                impossivel.append((turno, falta))
                break
            PLAN[cands[0][1]][FERIADO] = turno
            postos.append((cands[0][1], turno))
    if verbose:
        print(f"FASE 2 · feriado 12/10: {len(postos)} encaixes "
              f"(rotina no padrão do ano · folga só da MSalomão, pedido individual)")
        for ap, t in postos:
            print(f"   {ap} → {t}")
        for t, q in impossivel:
            print(f"   ⚠ faltam {q} em {t} e NÃO há mais ninguém elegível e livre")
        print(f"   cobertura final: {cobertura(FERIADO)} (alvo 14/10/7)")
    return postos, impossivel


def fase3_semana(verbose=True):
    """o resto da semana: tapar o que a fase 1 tenha aberto."""
    postos = []
    for dia in range(1, 32):
        if dia in DIAS_FDS or dia == FERIADO:
            continue
        for _v in range(20):
            m, t, n = cobertura(dia)
            alvo = mins(dia)
            faltas = [(x, q) for x, q in (("M", alvo[0]-m), ("T", alvo[1]-t), ("N", alvo[2]-n)) if q > 0]
            if not faltas:
                break
            turno = faltas[0][0]
            cands = sorted((sum(HOURS.get(l, 0) for l in PLAN[a].values())
                            - METAS.get(a, 0)*31/7, a) for a in PLAN
                           if pode_receber(a, dia, turno))
            if not cands:
                break
            PLAN[cands[0][1]][dia] = turno
            postos.append((cands[0][1], dia, turno))
            NOVAS.append((cands[0][1], dia, turno, "dia útil"))
    if verbose:
        print(f"FASE 3 · resto da semana: {len(postos)} encaixes")
        for ap, dia, t in postos:
            print(f"   {dia:02d}/10 {t}: {ap}")
    return postos


def fase4_ajuste_fino(verbose=True):
    """dois movimentos que o preenchimento puro não faz:
    (a) troca de turno no MESMO dia: sai de turno com sobra, entra no que falta;
    (b) migração entre dias: mesmo turno, sai de dia com sobra pra dia com falta.
    Sempre respeitando janela declarada, descanso e teto — e sem abrir buraco novo."""
    moves = []
    for _rodada in range(12):
        mudou = False
        for dia in range(1, 32):
            m, t, n = cobertura(dia)
            alvo = (14, 10, 7) if dia == FERIADO else mins(dia)
            deficits = [("M", alvo[0]-m), ("T", alvo[1]-t), ("N", alvo[2]-n)]
            for turno, falta in deficits:
                if falta <= 0:
                    continue
                # (a) mesmo dia, turno com sobra → turno com falta
                feito = False
                for outro, idx in (("M", 0), ("T", 1), ("N", 2)):
                    if outro == turno:
                        continue
                    sobra = (m, t, n)[idx] - alvo[idx]
                    if sobra <= 0:
                        continue
                    for ap, pd in PLAN.items():
                        if ap in ROTINA or pd.get(dia) != outro:
                            continue
                        pd_backup = pd.pop(dia)
                        if (eligible(ap, dia, turno) and descanso_ok(ap, dia, turno)
                                and teto_ok(ap, dia, turno)):
                            pd[dia] = turno
                            moves.append((ap, dia, f"{outro}→{turno}", "mesmo dia"))
                            feito = True
                            break
                        pd[dia] = pd_backup
                    if feito:
                        break
                if feito:
                    mudou = True
                    break
                # (b) mesmo turno, vindo de dia com sobra
                for origem in range(1, 32):
                    if origem == dia:
                        continue
                    mo, to, no = cobertura(origem)
                    ao = (14, 10, 7) if origem == FERIADO else mins(origem)
                    idx = {"M": 0, "T": 1, "N": 2}[turno]
                    if (mo, to, no)[idx] - ao[idx] <= 0:
                        continue
                    for ap, pd in PLAN.items():
                        if ap in ROTINA or pd.get(origem) != turno or dia in pd:
                            continue
                        del pd[origem]
                        if (eligible(ap, dia, turno) and descanso_ok(ap, dia, turno)
                                and teto_ok(ap, dia, turno)):
                            pd[dia] = turno
                            moves.append((ap, f"{origem:02d}→{dia:02d}", turno, "migração"))
                            feito = True
                            break
                        pd[origem] = turno
                    if feito:
                        break
                if feito:
                    mudou = True
                    break
            if mudou:
                break
        if not mudou:
            break
    if verbose:
        print(f"FASE 4 · ajuste fino: {len(moves)} remanejamentos")
        for ap, d, t, tipo in moves:
            print(f"   {tipo}: {ap} {d} {t}")
    return moves


def rodar(verbose=True):
    NOVAS.clear()
    despir_convocacoes(verbose)
    m0 = fase0_rotina(verbose)
    m0b, pend_set = fase0b_setembro(verbose)
    m1a, buracos_fds = fase1a_preencher_fds(verbose)
    if verbose:
        print(f"injustiça inicial (soma dos desvios de cota): {injusticas()}h")
    m1 = fase1_fds(verbose)
    if verbose:
        print(f"injustiça depois da fase 1: {injusticas()}h\n")
    m2, imp = fase2_feriado(verbose)
    m3 = fase3_semana(verbose)
    m4 = fase4_ajuste_fino(verbose)
    # segunda passada de justiça: as fases 2–4 adicionam fds depois da primeira,
    # e sem isso o preenchimento despeja tudo em quem tem menos veto
    m1bis = fase1_fds(verbose)
    m4bis = fase4_ajuste_fino(verbose)
    return PLAN, {"rotina": m0, "setembro": m0b, "pend_setembro": pend_set,
                  "fds_preenchido": m1a, "buracos_fds": buracos_fds,
                  "fds": m1, "feriado": m2, "impossivel": imp, "semana": m3, "ajuste_fino": m4, "justica_bis": m1bis, "fino_bis": m4bis,
                  "novas": list(NOVAS)}


if __name__ == "__main__":
    PLAN, mov = rodar()
    print("\n=== COBERTURA FINAL ===")
    falta_total = 0
    for dia in range(1, 32):
        m, t, n = cobertura(dia)
        alvo = (14, 10, 7) if dia == FERIADO else mins(dia)
        f = sum(max(0, a-b) for a, b in zip(alvo, (m, t, n)))
        falta_total += f
        if f:
            print(f"  {dia:02d}/10 falta {f}: {m}/{alvo[0]} {t}/{alvo[1]} {n}/{alvo[2]}")
    print(f"  buracos totais: {falta_total}")
    print("\n=== COTA DE FDS ===")
    fora = [(horas_fds(a)-alvo_fds(a), a, horas_fds(a), alvo_fds(a)) for a in PLAN
            if cota_fds(a) and abs(horas_fds(a)-alvo_fds(a)) > 6]
    print(f"  fator do mês (5 sábados): x{FATOR:.3f} — cota 36h vira alvo "
          f"{36*FATOR:.0f}h, cota 24h vira {24*FATOR:.0f}h")
    print(f"  pessoas fora do ALVO por mais de 6h: "
          f"{sum(1 for a in PLAN if cota_fds(a) and abs(horas_fds(a)-alvo_fds(a))>6)}"
          f" · soma dos desvios: {injusticas():.0f}h")
    for exc, ap, h, c in sorted(fora, reverse=True)[:12]:
        print(f"    {ap:12s} {h:3d}h / alvo {c:5.1f}h  {exc:+6.1f}h")
