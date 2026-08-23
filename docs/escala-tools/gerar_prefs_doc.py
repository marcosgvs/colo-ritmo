#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Documento padronizado com as preferências de todos os médicos.

Fontes (nada digitado à mão além dos ESPECIAIS, curados do doc de referência §7):
- pedidos autorais de outubro: PLAN do escala_out_v3 SEM as convocações;
- janelas declaradas: ALLOW (turnos por dia da semana, dias bloqueados, máx.
  noturnos/semana, sem noites consecutivas);
- ficha estrutural: ROSTER do v4_dados (restrições, sexta-noite, FDS extra);
- compromissos de setembro e cortes por teto: remontar_fds.

Uso:  python3 gerar_prefs_doc.py [saida.html]
"""
import datetime as dt
import html
import os
import runpy
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import v4_dados as D

WD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
ORDEM_COD = ["M", "T", "D", "N", "NT", "C", "J", "E", "A", "P", "R"]
NOME_COD = {"M": "Manhã", "T": "Tarde", "D": "Dia 12h", "N": "Noite", "NT": "Noitinha",
            "C": "Chefia 10h", "J": "8–13h", "E": "CEP", "A": "Administrativo",
            "P": "Paliativo", "R": "CRO"}

# especiais de outubro — curadoria do docs/escala-hcb-referencia.md §7 e decisões da sessão
ESPECIAIS = {
    "MSalomão": "Folga na manhã do feriado 12/10 — pedido individual, atendido.",
    "JuBrito": "Não faz o feriado 12/10 (atendido) · ficha de setembro: +12h na S1 (cumprido).",
    "Kozak": "Folga no sábado 31/10, aniversário da filha — atendida.",
    "MayWobido": "Abono de aniversário 31/10 — concedido · pediu a sexta-noite 16/10 "
                 "(negada pelo rodízio: 5 no ano; ficou com 09/10 N, que ela ofereceu).",
    "Marilia": "Pediu a sexta-noite de outubro (16/10) antecipada — concedida, caso "
               "autorizado pela chefia.",
    "Fernando": "Troca: sábado 17/10 → domingo 04/10 manhã · ofereceu a sexta-noite 23/10.",
    "Iggor": "Reivindicou a sexta-noite 23/10 (a mesma que Fernando ofereceu).",
    "Amanda": "Não escalar FDS extra em outubro (fez horas a mais em setembro) — atendido.",
    "Constantino": "Trabalhou o feriado 07/09 → folga em 12/10 · não escalar no FDS "
                   "10–11 — atendidos.",
    "JuCoutinho": "Prefere plantões de 6h em vez de 12h.",
    "LuAlice": "Não lançar as sextas 02 e 30/10 à noite — atendido.",
    "Joaquim": "Sem sexta-noite neste mês (excepcional).",
    "Neyde": "Perguntou se pode fazer a noite de 18/10 na véspera das férias.",
    "Yuji": "Licença-paternidade: DPP 09/10, 20 dias (pode antecipar) · até lá pode "
            "todas as manhãs (excepcional).",
    "Kariny": "Repouso 09–12/10 (procedimento) — não escalar.",
    "Grayce": "Não lançar 6h avulsas, preferir 12h · aniversário 19/10, sem pedido de abono.",
    "Ernesto": "E-mail novo: dr.carlos.ernesto.pediatra@gmail.com · ficha de setembro "
               "(S1 → 24h) NÃO executável: a paridade 15/15 dele é FDS 09/11 e 23/25.",
    "Pabdo": "Aniversário 29/10, sem folga.",
    "Isabella": "Inverteu a disponibilidade: não pode mais sextas.",
    "Danielle": "Ficha de setembro: +24h na S1 — cumprido.",
    "Fabiula": "Ficha de setembro: +12h na S1 · o teto de 44h cortou noites autorais.",
    "Leomara": "Ficha de setembro: S1 → 24h — parcial (18h; sem slot nas janelas).",
    "Pedro": "Ficha de setembro: S1 → 24h — parcial (18h; sem slot nas janelas).",
    "Heloa": "Ficha de setembro: S1 → 24h — cumprido.",
    "Raylander": "Ficha de setembro: S1 → 30h (fonte fraca — anotação do doc, sem "
                 "linha OUTUBRO na ficha).",
    "Vinicius": "Ficha de setembro: completar a semana de abertura para 42h.",
}


def _faixas(dias):
    """[19,20,21,25] -> '19–21 · 25'"""
    dias = sorted(dias)
    saida, ini = [], None
    for i, d in enumerate(dias):
        if ini is None:
            ini = d
        fim_seq = i + 1 == len(dias) or dias[i + 1] != d + 1
        if fim_seq:
            saida.append(f"{ini:02d}–{d:02d}" if d != ini else f"{d:02d}")
            ini = None
    return " · ".join(saida)


def _dias_wd(dias):
    return " · ".join(f"{d:02d} {WD[dt.date(2026, 10, d).weekday()]}" for d in sorted(dias))


def _janela(ap, ALLOW):
    if ap not in ALLOW:
        return None
    wdmap, blocked, maxn, noconsec = ALLOW[ap]
    partes = []
    if not wdmap:
        partes.append("Estritas — somente os dias que pediu")
    elif all(wdmap.get(i) == "MTN" for i in range(7)):
        partes.append("Amplas — qualquer dia e turno")
    else:
        dias = [f"{WD[i]} {wdmap[i]}" for i in range(7) if wdmap.get(i)]
        partes.append(" · ".join(dias) if dias else "Estritas — somente os dias que pediu")
    if blocked:
        partes.append(f"Bloqueados: {_faixas(blocked)}")
    if maxn == 0:
        partes.append("Sem noturno além do pedido")
    elif maxn in (1, 2, 3):
        partes.append(f"Máx. {maxn} noturno{'s' if maxn > 1 else ''}/semana")
    if noconsec:
        partes.append("Sem noites consecutivas")
    return " · ".join(partes)


def montar(caminho_saida):
    ns = runpy.run_path(os.path.join(AQUI, "escala_out_v3.py"))
    PLAN, CONVOC, ALLOW = ns["PLAN"], ns["CONVOC"], ns["ALLOW"]
    CHUTES = ns["CHUTES"]
    # autoral = plano menos convocações
    for ap, d, t in CONVOC:
        if PLAN.get(ap, {}).get(d) == t:
            del PLAN[ap][d]
    import remontar_fds as RF
    _plano, mov = RF.rodar(verbose=False)
    cortes = {}
    for ap, d, l, _m in mov.get("setembro", []):
        cortes.setdefault(ap, []).append((d, l))

    ROT = {"Fred", "Milena", "Pabdo", "MSalomão", "DebAlves", "Vinicius", "Amelio", "Murilo"}
    GRUPOS = [("Chefia e rotina", ("chefia", "rotina"),
               "Regra de 18/08/26: dias úteis apenas pela manhã, nunca aos fins de semana. "
               "Não enviam preferências — o padrão é fixo, e o 10h de chefia (47) é lançado "
               "depois pela coordenação. O feriado segue a contagem anual."),
              ("Carga de 36–40h", ("36h",), ""),
              ("Carga de 30h", ("30h",), ""),
              ("Carga de 24h", ("24h",), ""),
              ("Administrativo", ("administrativo",),
               "Não pegam plantão — código 11 diário.")]

    corpo = []
    indice = []
    for titulo, grupos, nota in GRUPOS:
        pessoas = [r for r in D.ROSTER if r[3] in grupos]
        corpo.append(f'<h2>{html.escape(titulo)} <span class="qtd">{len(pessoas)}</span></h2>')
        if nota:
            corpo.append(f'<p class="secnote">{html.escape(nota)}</p>')
        for ap, nome, ch, grupo, restr, sn, fe, obs in pessoas:
            indice.append(f'<a href="#{ap}">{html.escape(ap)}</a>')
            chips = [f'<span class="chip c-ch">{ch}h</span>']
            if ap in CHUTES:
                chips.append('<span class="chip c-open">NÃO ENVIOU — PROVISÓRIO</span>')
            if sn and sn not in ("não",):
                chips.append(f'<span class="chip c-med">SN {html.escape(sn)}</span>')
            if fe and fe not in ("não",):
                chips.append(f'<span class="chip c-mine">FDS extra {html.escape(fe)}</span>')
            linhas = []
            jan = _janela(ap, ALLOW)
            if jan and ap not in ROT:
                linhas.append(("Janelas declaradas", jan))
            if restr:
                linhas.append(("Ficha e vetos", restr))
            pd = PLAN.get(ap, {})
            if ap in CHUTES:
                linhas.append(("Pedidos do e-mail",
                               "NÃO ENVIOU preferências. O que está na escala é padrão "
                               "provisório montado a partir de setembro e dos fixos — "
                               "não representa pedido da pessoa."))
                pd = {}
            if ap not in ROT and pd:
                por_cod = {}
                for d, l in pd.items():
                    por_cod.setdefault(l, []).append(d)
                pedidos = [f"<b>{NOME_COD.get(c, c)}:</b> {_dias_wd(por_cod[c])}"
                           for c in ORDEM_COD if c in por_cod]
                if pedidos:
                    linhas.append(("Pedidos do e-mail", " &nbsp;·&nbsp; ".join(pedidos)))
                aus = [(c, por_cod[c]) for c in ("FE", "LM") if c in por_cod]
                for c, ds in aus:
                    rot = "Férias" if c == "FE" else "Licença"
                    linhas.append((rot, f"{_faixas(ds)}/10"))
            if ap in cortes:
                linhas.append(("Corte por teto de 44h",
                               _dias_wd([d for d, _l in cortes[ap]]) + " — a lei ganha da preferência"))
            if ap in ESPECIAIS:
                linhas.append(("Especiais", ESPECIAIS[ap]))
            if obs:
                linhas.append(("Observações", obs))
            campos = "".join(
                f'<div class="campo"><span class="rotulo">{html.escape(r)}</span>'
                f'<span class="valor">{v if r == "Pedidos do e-mail" else html.escape(str(v))}</span></div>'
                for r, v in linhas)
            corpo.append(
                f'<section class="pessoa" id="{ap}"><h3>{html.escape(ap)} '
                f'<span class="nome">{html.escape(nome)}</span> {" ".join(chips)}</h3>'
                f'{campos}</section>')

    pagina = PAGINA.replace("__INDICE__", " · ".join(indice)).replace("__CORPO__", "\n".join(corpo))
    with open(caminho_saida, "w", encoding="utf-8") as f:
        f.write(pagina)
    return caminho_saida


PAGINA = """<title>Preferências da Equipe UTI HCB</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap">
<style>
  :root { --bg:#FFFAF3; --surface:#FAF3E8; --line:#EBE8E5; --ink:#3A2E2A; --ink-2:#6B5C56;
          --ink-3:#9A8A82; --brand:#5A4E8C; --brand-soft:#ECEAF4; --ok:#5A6E50; --ok-soft:#ECF6E7;
          --med:#3D7884; --med-soft:#EAF2F9; --mine:#A8742A; --mine-soft:#FBF1E1;
          --open:#C77264; --open-soft:#FBE9E5; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg:#241D19; --surface:#2C2420; --line:#3C332D; --ink:#F0E7DD; --ink-2:#C8BBAF;
    --ink-3:#96897E; --brand:#B9B0DF; --brand-soft:#35304A; --ok:#A9C89B; --ok-soft:#2C3527;
    --med:#8FC0CC; --med-soft:#24363C; --mine:#DDAE62; --mine-soft:#3D3021;
    --open:#E5A196; --open-soft:#422C28; } }
  :root[data-theme="dark"] {
    --bg:#241D19; --surface:#2C2420; --line:#3C332D; --ink:#F0E7DD; --ink-2:#C8BBAF;
    --ink-3:#96897E; --brand:#B9B0DF; --brand-soft:#35304A; --ok:#A9C89B; --ok-soft:#2C3527;
    --med:#8FC0CC; --med-soft:#24363C; --mine:#DDAE62; --mine-soft:#3D3021;
    --open:#E5A196; --open-soft:#422C28; }
  * { box-sizing: border-box; }
  body { background:var(--bg); color:var(--ink); margin:0;
         font-family:Nunito,"Segoe UI",system-ui,sans-serif; font-size:15px; line-height:1.55; }
  main { max-width:840px; margin:0 auto; padding:44px 24px 90px; }
  .eyebrow { font-family:Caveat,cursive; font-size:21px; color:var(--brand); margin:0; }
  h1 { font-family:Fraunces,Georgia,serif; font-size:32px; font-weight:700; margin:4px 0 8px; }
  .lede { color:var(--ink-2); max-width:66ch; margin:0 0 6px; }
  .meta { color:var(--ink-3); font-size:13px; margin:0 0 18px; }
  .indice { font-size:12.5px; color:var(--ink-3); line-height:1.9; background:var(--surface);
            border:1px solid var(--line); border-radius:12px; padding:12px 16px; }
  .indice a { color:var(--brand); text-decoration:none; }
  h2 { font-family:Fraunces,Georgia,serif; font-size:21px; color:var(--brand); margin:40px 0 4px; }
  h2 .qtd { color:var(--ink-3); font-size:14px; font-family:Nunito; font-weight:600; }
  .secnote { color:var(--ink-2); font-size:13.5px; max-width:70ch; margin:0 0 12px; }
  .pessoa { border:1px solid var(--line); border-radius:14px; padding:12px 16px;
            margin:10px 0; background:var(--bg); }
  .pessoa h3 { font-family:Fraunces,Georgia,serif; font-size:16.5px; margin:0 0 6px; }
  .pessoa .nome { color:var(--ink-3); font-family:Nunito; font-weight:600; font-size:12.5px; }
  .chip { display:inline-block; font-size:10.5px; font-weight:800; letter-spacing:.03em;
          padding:1px 8px; border-radius:16px; vertical-align:2px; }
  .c-ch { background:var(--brand-soft); color:var(--brand); }
  .c-med { background:var(--med-soft); color:var(--med); }
  .c-mine { background:var(--mine-soft); color:var(--mine); }
  .c-open { background:var(--open-soft); color:var(--open); }
  .campo { display:flex; gap:12px; padding:3px 0; border-top:1px dashed var(--line); }
  .campo:first-of-type { border-top:none; }
  .rotulo { flex:0 0 148px; font-size:11px; font-weight:800; letter-spacing:.04em;
            text-transform:uppercase; color:var(--ink-3); padding-top:2px; }
  .valor { color:var(--ink-2); font-size:13.5px; }
  .valor b { color:var(--ink); }
</style>
<main>
  <p class="eyebrow">Colo Ritmo · Hospital da Criança de Brasília</p>
  <h1>Preferências da Equipe UTI HCB</h1>
  <p class="lede">As preferências de outubro de 2026 <b>como enviadas nos e-mails</b> — transcritas para um formato único: pedidos por turno, janelas declaradas, ficha e pedidos especiais. Conferido por amostragem contra os e-mails originais. Se algo estiver diferente do que a pessoa mandou, é aqui que se corrige.</p>
  <p class="meta">Gerado em 23/08/2026 pelo gerar_prefs_doc.py · Fontes: e-mails de preferências (via escala_out_v3), janelas ALLOW, CADASTRO e fichas de setembro · Convocações NÃO aparecem aqui — são plantões fora de preferência e vivem na aba CONVOCAÇÕES.</p>
  <div class="indice">__INDICE__</div>
__CORPO__
</main>
"""

if __name__ == "__main__":
    destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "prefs-medicos.html")
    print("gerado:", montar(destino))
