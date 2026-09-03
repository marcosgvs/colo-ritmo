#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Formato 4: a página que responde as duas perguntas de quem abre a escala —
"quem está no plantão de tal dia?" e "quando é o meu?".

Não é um documento: é operada. Busca por nome destaca a pessoa no mês inteiro e
lista os plantões dela; o calendário mostra a lotação de cada turno contra o
mínimo, e o dia clicado abre com todos os nomes. Sistema visual do Colo Ritmo
(creme, tinta, lavanda, coral, areia · Fraunces + Nunito), que é o do produto.
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import export_dia_a_dia as E

dias, meta = E.carregar()
out = [d for d in dias if d["mes"] == 10]
pessoas = sorted({n.replace(" BHP", "") for d in dias
                  for c in ("manha", "tarde", "noite", "noitinha") for n in d[c]})
dados = {"meta": meta, "dias": dias, "pessoas": pessoas,
         "resumo": {"dias": len(out),
                    "buracos": sum(sum(d["falta"]) for d in out),
                    "dias_com_buraco": [d["label"] for d in out if sum(d["falta"])],
                    "plantoes": sum(len(d["manha"]) + len(d["tarde"]) + len(d["noite"])
                                    for d in out)}}

HTML = """<title>Plantões de outubro</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Nunito:wght@400;600;700&display=swap">
<style>
:root {
  --ground:#FFFAF3; --surface:#FAF3E8; --surface2:#F4EDE1; --line:#E4DCD0;
  --ink:#332824; --ink2:#6B5C56; --ink3:#9A8A82;
  --lav:#54487F; --lav-soft:#EDEAF5; --coral:#A94E3D; --coral-soft:#FAE4DF;
  --aqua:#1F6B78; --aqua-soft:#DDF0F2; --areia:#8A5F1C; --areia-soft:#F7EBD6;
  --r:3px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground:#1B1715; --surface:#241F1C; --surface2:#2C2622; --line:#3A322D;
    --ink:#F3EBE3; --ink2:#C5B5AA; --ink3:#96857A;
    --lav:#B3AAD9; --lav-soft:#2C2740; --coral:#EFA695; --coral-soft:#3E2620;
    --aqua:#8FD3DE; --aqua-soft:#173238; --areia:#E0B26A; --areia-soft:#3A2C15;
  }
}
:root[data-theme="dark"] {
  --ground:#1B1715; --surface:#241F1C; --surface2:#2C2622; --line:#3A322D;
  --ink:#F3EBE3; --ink2:#C5B5AA; --ink3:#96857A;
  --lav:#B3AAD9; --lav-soft:#2C2740; --coral:#EFA695; --coral-soft:#3E2620;
  --aqua:#8FD3DE; --aqua-soft:#173238; --areia:#E0B26A; --areia-soft:#3A2C15;
}
* { box-sizing:border-box; }
body { margin:0; background:var(--ground); color:var(--ink);
  font-family:Nunito, system-ui, -apple-system, sans-serif; font-size:15px; line-height:1.45; }
::selection { background:var(--lav-soft); color:var(--lav); }
.wrap { max-width:1180px; margin:0 auto; padding:26px 20px 60px; }
h1 { font-family:Fraunces, Georgia, serif; font-weight:600; font-size:clamp(26px,4vw,38px);
  margin:0; letter-spacing:-0.015em; text-wrap:balance; }
.linha-topo { display:flex; flex-wrap:wrap; align-items:flex-end; gap:14px 22px; }
.fonte { color:var(--ink2); font-size:13px; }
.fonte b { color:var(--ink); font-weight:600; }
.numeros { display:flex; gap:20px; margin:14px 0 0; padding:0; list-style:none;
  font-variant-numeric:tabular-nums; }
.numeros div { font-size:12px; color:var(--ink2); letter-spacing:.05em; text-transform:uppercase; }
.numeros strong { display:block; font-family:Fraunces, Georgia, serif; font-size:24px;
  font-weight:600; color:var(--ink); letter-spacing:-0.01em; }
.numeros .alerta strong { color:var(--coral); }
form { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:22px 0 6px;
  padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r); }
label { font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink2); }
input[type=search] { flex:1 1 220px; min-width:0; font:inherit; font-size:15px; color:var(--ink);
  background:var(--ground); border:1px solid var(--line); border-radius:var(--r);
  padding:7px 11px; }
input[type=search]::placeholder { color:var(--ink3); }
input:focus-visible, button:focus-visible, .dia:focus-visible { outline:2px solid var(--lav);
  outline-offset:2px; }
.turnos { display:flex; gap:2px; background:var(--surface2); padding:2px;
  border-radius:var(--r); border:1px solid var(--line); }
.turnos button { font:inherit; font-size:13px; font-weight:600; color:var(--ink2);
  background:none; border:0; padding:5px 12px; border-radius:2px; cursor:pointer; }
.turnos button[aria-pressed=true] { background:var(--ground); color:var(--lav);
  box-shadow:0 1px 2px rgba(51,40,36,.10); }
.grade { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-top:16px; }
.dow-cab { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink3);
  padding:0 0 2px 3px; }
.dia { position:relative; display:block; width:100%; text-align:left; cursor:pointer;
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:7px 8px 8px; font:inherit; color:inherit;
  transition:background .12s ease-out, border-color .12s ease-out; }
.dia.fds { background:var(--lav-soft); }
.dia.fer { background:var(--coral-soft); }
.dia[aria-pressed=true] { border-color:var(--ink); }
.dia .d { display:flex; align-items:baseline; gap:5px; }
.dia .num { font-family:Fraunces, Georgia, serif; font-size:19px; font-weight:600;
  font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
.dia .dw { font-size:11px; color:var(--ink2); }
.dia .fs { font-size:9.5px; font-weight:700; color:var(--coral); text-transform:uppercase;
  letter-spacing:.04em; margin-left:auto; }
.medidor { display:grid; gap:3px; margin-top:7px; }
.m { display:grid; grid-template-columns:12px 1fr 30px; align-items:center; gap:5px;
  font-size:11px; color:var(--ink2); font-variant-numeric:tabular-nums; }
.barra { height:4px; background:var(--surface2); border-radius:2px; overflow:hidden; }
.barra i { display:block; height:100%; background:var(--lav); }
.m.falta { color:var(--coral); font-weight:700; }
.m.falta .barra i { background:var(--coral); }
.m .q { text-align:right; }
.marca { position:absolute; inset:auto 6px 6px auto; font-size:10px; font-weight:700;
  letter-spacing:.04em; color:var(--aqua); text-transform:uppercase; }
.dia.tem { background:var(--aqua-soft); border-color:var(--aqua); }
.dia.apagado { opacity:.36; }
.dia.apagado .marca { display:none; }
.detalhe { margin-top:26px; display:grid; gap:18px;
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); }
.turno-bloco h3 { font-family:Fraunces, Georgia, serif; font-size:15px; font-weight:600;
  margin:0 0 2px; color:var(--lav); }
.turno-bloco .hora { font-size:11px; color:var(--ink3); letter-spacing:.05em;
  text-transform:uppercase; }
.turno-bloco ul { list-style:none; margin:8px 0 0; padding:0; display:grid; gap:1px; }
.turno-bloco li { padding:3px 0; border-bottom:1px solid var(--line); font-size:14px; }
.turno-bloco li:last-child { border-bottom:0; }
.turno-bloco li.eu { color:var(--aqua); font-weight:700; }
.turno-bloco li b { font-size:10px; font-weight:700; letter-spacing:.05em; color:var(--areia);
  margin-left:5px; vertical-align:1px; }
.turno-bloco .falta-aqui { color:var(--coral); font-weight:700; font-size:13px; margin-top:6px; }
.cab-detalhe { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;
  border-bottom:1.5px solid var(--ink); padding-bottom:8px; }
.cab-detalhe h2 { font-family:Fraunces, Georgia, serif; font-weight:600; font-size:22px;
  margin:0; letter-spacing:-0.01em; }
.cab-detalhe .bhn { color:var(--ink2); font-size:13px; font-style:italic; }
.eu-lista { margin-top:22px; padding:16px; background:var(--aqua-soft);
  border:1px solid var(--aqua); border-radius:var(--r); }
.eu-lista h2 { font-family:Fraunces, Georgia, serif; font-size:19px; font-weight:600;
  margin:0 0 3px; }
.eu-lista .resumo { font-size:13px; color:var(--ink2); }
.eu-lista ol { list-style:none; margin:12px 0 0; padding:0; display:grid; gap:4px;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); font-variant-numeric:tabular-nums; }
.eu-lista li { font-size:14px; }
.eu-lista li span { color:var(--ink2); }
.legenda { margin-top:30px; font-size:12.5px; color:var(--ink2); display:grid; gap:4px; }
.legenda b { color:var(--ink); font-weight:600; }
@media (max-width:720px) {
  .grade { grid-template-columns:repeat(2,1fr); }
  .dow-cab { display:none; }
  .dia .dw { display:inline; }
}
@media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
</style>
<div class="wrap">
<div class="linha-topo">
  <h1>Outubro de 2026</h1>
  <div class="fonte">Escala da UTI · <b>Hospital da Criança de Brasília</b><br>
  __FONTE__ · gerado em __GERADO__</div>
</div>
<div class="numeros">
  <div>plantões no mês<strong>__PLANTOES__</strong></div>
  <div>dias<strong>__DIAS__</strong></div>
  <div class="__CLS_BUR__">turnos abaixo do mínimo<strong>__BURACOS__</strong></div>
</div>

<form onsubmit="return false">
  <label for="busca">Procurar médico</label>
  <input id="busca" type="search" list="nomes" placeholder="digite um nome, ex. Kariny"
         autocomplete="off">
  <datalist id="nomes"></datalist>
  <div class="turnos" role="group" aria-label="Filtrar por turno">
    <button type="button" data-t="" aria-pressed="true">todos</button>
    <button type="button" data-t="manha" aria-pressed="false">manhã</button>
    <button type="button" data-t="tarde" aria-pressed="false">tarde</button>
    <button type="button" data-t="noite" aria-pressed="false">noite</button>
  </div>
</form>

<div class="grade" id="cabecalho"></div>
<div class="grade" id="grade"></div>
<div id="eu"></div>
<div id="detalhe"></div>

<div class="legenda">
  <div><b>A barra de cada turno</b> compara quem está escalado com o mínimo do dia:
  14 · 10 · 7 em dia útil, 10 · 8 · 7 no sábado, 9 · 8 · 7 no domingo. Coral quando falta gente.</div>
  <div><b>BHP</b> é plantão a mais, que fica no banco de horas. <b>BHN</b> é dispensa paga pelo
  banco: a pessoa não vem, e aparece no rodapé do dia.</div>
  <div><b>Feriado</b> escala como o dia da semana em que cai, então o mínimo não muda.</div>
</div>
</div>
<script>
const DADOS = __DADOS__;
const WD3 = ["seg","ter","qua","qui","sex","sáb","dom"];
const TURNOS = [["manha","manhã","07–13h"],["tarde","tarde","13–19h"],["noite","noite","19–07h"]];
const outubro = DADOS.dias.filter(d => d.mes === 10);
let sel = outubro[0].data, alvo = "", filtro = "";

const norm = s => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();
const semBhp = n => n.replace(" BHP","");
const temPessoa = (d, nome) => !nome ? false : TURNOS.some(([c]) =>
  (filtro && c !== filtro) ? false : d[c].some(n => semBhp(n) === nome));
const turnoDe = (d, nome) => TURNOS.filter(([c]) => d[c].some(n => semBhp(n) === nome))
  .map(([c,r]) => r).join(" e ");

document.getElementById("nomes").innerHTML =
  DADOS.pessoas.map(p => `<option value="${p}"></option>`).join("");
document.getElementById("cabecalho").innerHTML =
  WD3.map(w => `<div class="dow-cab">${w}</div>`).join("");

function pintaGrade() {
  const primeiro = outubro[0];
  const vazios = WD3.indexOf(primeiro.dow3);
  const celulas = Array(vazios).fill('<div></div>');
  for (const d of outubro) {
    const marcado = temPessoa(d, alvo);
    const cls = ["dia", d.feriado ? "fer" : (d.fds ? "fds" : ""),
                 marcado ? "tem" : (alvo ? "apagado" : "")].filter(Boolean).join(" ");
    const medidor = TURNOS.map(([c,rot],i) => {
      if (filtro && c !== filtro) return "";
      const q = d.cob[i], m = d.min[i], falta = d.falta[i];
      const larg = Math.min(100, Math.round(q / m * 100));
      return `<div class="m ${falta ? "falta" : ""}"><span>${rot[0].toUpperCase()}</span>
        <span class="barra"><i style="width:${larg}%"></i></span>
        <span class="q">${q}/${m}</span></div>`;
    }).join("");
    celulas.push(`<button class="${cls}" data-dia="${d.data}" type="button"
      aria-pressed="${d.data === sel}"
      aria-label="${d.dia} de outubro, ${d.dow}${d.feriado ? ", " + d.feriado : ""}">
      <span class="d"><span class="num">${String(d.dia).padStart(2,"0")}</span>
      <span class="dw">${d.dow3}</span>
      ${d.feriado ? `<span class="fs">${d.sigla}</span>` : ""}</span>
      <span class="medidor">${medidor}</span>
      ${marcado ? `<span class="marca">${turnoDe(d, alvo)}</span>` : ""}</button>`);
  }
  document.getElementById("grade").innerHTML = celulas.join("");
  document.querySelectorAll(".dia").forEach(b =>
    b.addEventListener("click", () => { sel = b.dataset.dia; pintaGrade(); pintaDetalhe(); }));
}

function pintaDetalhe() {
  const d = DADOS.dias.find(x => x.data === sel);
  const blocos = TURNOS.map(([campo, rot, hora], i) => {
    const lista = d[campo].map(n => {
      const p = semBhp(n);
      return `<li class="${p === alvo ? "eu" : ""}">${p}${n !== p ? "<b>BHP</b>" : ""}</li>`;
    }).join("") || '<li style="color:var(--ink3)">ninguém escalado</li>';
    return `<div class="turno-bloco"><h3>${rot}</h3><div class="hora">${hora} ·
      ${d.cob[i]} de ${d.min[i]}</div><ul>${lista}</ul>
      ${d.falta[i] ? `<div class="falta-aqui">faltam ${d.falta[i]}</div>` : ""}</div>`;
  }).join("");
  document.getElementById("detalhe").innerHTML = `
    <div class="cab-detalhe"><h2>${d.dia} de outubro · ${d.dow}</h2>
    ${d.feriado ? `<span class="fs" style="color:var(--coral);font-weight:700">${d.feriado}</span>` : ""}
    ${d.bhn.length ? `<span class="bhn">${d.bhn.join(" · ")}</span>` : ""}</div>
    <div class="detalhe">${blocos}</div>`;
}

function pintaEu() {
  const caixa = document.getElementById("eu");
  if (!alvo) { caixa.innerHTML = ""; return; }
  const meus = outubro.filter(d => temPessoa(d, alvo));
  const horas = meus.reduce((s,d) => s + (turnoDe(d,alvo).includes(" e ") ? 12 :
    (turnoDe(d,alvo) === "noite" ? 12 : 6)), 0);
  caixa.innerHTML = `<div class="eu-lista"><h2>${alvo} em outubro</h2>
    <div class="resumo">${meus.length} ${meus.length === 1 ? "dia" : "dias"} de plantão${
      filtro ? " no turno da " + filtro : ""}</div>
    <ol>${meus.map(d => `<li>${String(d.dia).padStart(2,"0")}/10
      <span>${d.dow3} · ${turnoDe(d, alvo)}</span></li>`).join("")
      || "<li>nenhum plantão com esse filtro</li>"}</ol></div>`;
}

document.getElementById("busca").addEventListener("input", e => {
  const v = norm(e.target.value.trim());
  alvo = DADOS.pessoas.find(p => norm(p) === v) ||
         (v.length >= 2 ? DADOS.pessoas.find(p => norm(p).startsWith(v)) : "") || "";
  pintaGrade(); pintaEu(); pintaDetalhe();
});
document.querySelectorAll(".turnos button").forEach(b =>
  b.addEventListener("click", () => {
    filtro = b.dataset.t;
    document.querySelectorAll(".turnos button").forEach(x =>
      x.setAttribute("aria-pressed", String(x === b)));
    pintaGrade(); pintaEu();
  }));

pintaGrade(); pintaDetalhe();
</script>"""

html = (HTML.replace("__DADOS__", json.dumps(dados, ensure_ascii=False))
        .replace("__FONTE__", meta["fonte"]).replace("__GERADO__", meta["gerado"])
        .replace("__PLANTOES__", str(dados["resumo"]["plantoes"]))
        .replace("__DIAS__", str(dados["resumo"]["dias"]))
        .replace("__BURACOS__", str(dados["resumo"]["buracos"]))
        .replace("__CLS_BUR__", "alerta" if dados["resumo"]["buracos"] else ""))
destino = os.path.join(E.SAIDA, "4 · dia a dia · painel.html")
open(destino, "w").write(html)
print(destino, round(len(html) / 1024), "kb ·", len(pessoas), "pessoas no índice")

# a mesma página servida em colopediatria.com.br/escala/outubro. Mesmo padrão das
# outras páginas públicas da escala: documento completo e noindex (a página tem o
# nome de 63 pessoas — não é para cair em buscador; quem tem o link, abre).
SITE = os.path.join(os.path.dirname(AQUI), "..", "public", "escala", "outubro")
SITE = os.path.normpath(SITE)
os.makedirs(SITE, exist_ok=True)
cabeca, corpo = html.split("</style>", 1)
pagina = ("<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n"
          "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
          "<meta name=\"robots\" content=\"noindex,nofollow\">\n"
          "<meta name=\"description\" content=\"Escala da UTI do Hospital da Criança de "
          "Brasília em outubro de 2026: quem está em cada turno, dia a dia.\">\n"
          + cabeca + "</style>\n</head>\n<body>" + corpo + "\n</body>\n</html>\n")
alvo = os.path.join(SITE, "index.html")
open(alvo, "w").write(pagina)
print(alvo, round(len(pagina) / 1024), "kb")
