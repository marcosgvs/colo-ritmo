# Q&A das regras — roteiro preparado (para a sessão de revisão)

> **01/09/26:** o Marcos pediu pra aplicar tudo direto na planilha V3 em vez do Q&A. As
> decisões tomadas (com as escolhas de dia justificadas) estão em `checagem_out_v3.py` e
> na aba CHECAGEM OUT da V3. Este roteiro fica como registro das perguntas em aberto
> (A7 proporção do retorno de férias, B5 dias do CRO, B7 dom 18/10 N).

> Pedido do Marcos (28/08+): "um Q&A de tudo que você aprendeu para revisarmos regra por
> regra, você perguntando e nós clicando a resposta certa". Este arquivo é o roteiro.
> Mecânica: perguntas via AskUserQuestion (opções clicáveis), em blocos de até 4,
> com a minha recomendação marcada. Cada resposta atualiza: o documento de regras
> (docs/escala-hcb-referencia.md + página pública), o validador/planilha e o motor de
> novembro. Contexto dos 25 itens: memória `mari-checagem-bhp-bhn`.

## Passo zero (antes de qualquer pergunta)

1. **Re-transcrever a aba OUT do Sheet vivo** → `mari_out_dados.py` v2 (a Mari editou
   41+ células depois de 28/08; os números abaixo marcados [28/08] podem ter mudado).
2. Recomputar as semanas civis por pessoa (com vésperas de setembro e 01/11) e a lista
   de buracos — os dados atuais entram nas perguntas do Bloco B.
3. Fazer backup do Sheet vivo no Drive antes de aplicar qualquer resposta.

---

## BLOCO A · As meta-regras novas (confirmar o entendimento)

**A1. Alvo semanal.** A carga contratada (24/30/36/40h) deve bater **semana civil a
semana civil** (seg–dom, contando os dias de setembro que fecham a 1ª semana)?
- (a) Sim — todo desvio semanal vira BHP/BHN explícito *(recomendada — é o que os 25 itens fazem)*
- (b) Só a média do mês precisa bater; a semana é orientativa
- (c) Semana a semana, mas com tolerância de ±6h sem BHP/BHN

**A2. Grafia do BHP/BHN na planilha.** Como escrever na matriz mensal?
- (a) Códigos novos no dropdown: o turno + marcador — ex. `M+` (BHP) e `M-`/`BHN` — com
  cores próprias *(recomendada — mantém contagem automática)*
- (b) Escrever "BHP"/"BHN" como texto na célula (perde a contagem do turno)
- (c) Só no formato da grade oficial (nome + BHP inline; BHN em linha no fim do dia),
  a matriz não muda

**A3. Contagem do BHP/BHN nas calculadoras.** Um plantão BHP conta nas horas da semana
em que foi trabalhado (estourando a CH de propósito) e o BHN desconta na semana da
dispensa — e o SALDO de banco vira uma coluna própria por pessoa?
- (a) Sim, com coluna "banco" por pessoa somando +BHP −BHN no mês *(recomendada)*
- (b) BHP/BHN ficam fora das somas — só anotação

**A4. Regra dos 40h (DebAlves e MSalomão).** Confirmando: exatamente UMA semana de 36h
no mês e todas as demais de 42h?
- (a) Sim, regra fixa dos dois *(recomendada — itens 6 e 18)*
- (b) Sim, mas só quando o mês tem 5 semanas
- (c) Vale só pra este outubro

**A5. Cota de fim de semana é piso também?** (IsaRibeiro com 18h de 24h → completar)
- (a) Sim: cota é alvo exato — nem passar nem faltar *(recomendada — item 11)*
- (b) É só teto; faltar pode

**A6. Regra fixa da Kariny.** Sáb+dom do mesmo fds ⇒ BHN na segunda seguinte (nunca
4 dias de 12h emendados) + BHP na quinta anterior. O BHN pode migrar pro dia útil mais
cheio da semana (como o 06/10 desta vez)?
- (a) Sim, exatamente assim — regra permanente dela *(recomendada — item 8)*
- (b) A regra vale, mas o BHN é sempre na segunda, sem migrar

**A7. Semana de retorno de férias.** Thamyres "seriam só 18h" (CH 24) e Vinicius
"precisa ser 30h" (CH 36) — qual é a regra do alvo reduzido?
- (a) Alvo proporcional aos dias disponíveis da semana após o retorno *(recomendada)*
- (b) Alvo cheio menos 6h fixas na semana de retorno
- (c) Caso a caso, sem fórmula

**A8. Senior e o banco (item 25).** Confirmando o comportamento no arquivo do RH:
célula BHP **não gera código** (não é digitada) e célula BHN **gera o código do turno
normal** (como se trabalhado)?
- (a) Exatamente isso *(recomendada — aplicar na aba SENIOR e no export)*
- (b) Outro comportamento (explicar)

---

## BLOCO B · Decisões pontuais dos 25 itens (dados a atualizar no passo zero)

**B1. DebAlves** [28/08: S3 (12–18/10) e S5 (26/10–01/11) = 36h]: qual vira 42h?
Recomendação: a semana com mais falta de cobertura no dia/turno onde ela pode entrar
(apresentar os buracos atuais como opções concretas de dia+turno).

**B2. MSalomão** [28/08: S1, S2 e S5 = 36h → duas viram 42h]: quais duas, e em quais
dias/turnos entram as 6h de cada.

**B3. Anna (item 2):** BHP no sáb 03/10 confirmado; o BHN de 12h sai de onde —
1 plantão de 12h ou 2 de 6h? Em quais semanas (todas as outras estão em 24h justas)?

**B4. Kariny (item 8):** confirmar BHN no 06/10 + BHP como D no 01/10 (a DebMatias sai
da tarde de 01/10 — item 5 — e a Kariny cobre).

**B5. LuAlice (item 14):** tirar o D de 02/10 → lançar 2 períodos de CRO (código R) em
quais dias? Isabella assume a tarde de 02/10 (fecha o item 10 dela também).
*Resposta pronta pra pergunta do Marcos: o 02D foi lançado pela própria Mari em 28/08
(não estava na proposta do gerador — diff registrado).*

**B6. Neyde (item 16):** BHP no 04/10 N + BHN "no 17/10 noite" — ela não tem plantão em
17/10: o BHN é lançado como linha de dispensa naquele dia mesmo sem plantão dela, certo?

**B7. Moabe (item 21):** os 36h da S1 são BHP compensando a S2 de 12h? E o conserto do
18N→19D (24h emendadas): tirar qual dos dois, e quem cobre?

**B8. Aline (item 1):** em quais dias exatos entram os E que faltam (regra: 1ª terça =
reunião; demais semanas seg ou qui manhã; férias a partir de 19/10)?

**B9. Raquel (item 4):** os CP (código P) que faltam — quais dias na semana do retorno
e na última semana? E confirmar: o rótulo certo de P é "CP/cuidados paliativos"?
(o CONFIG hoje chama "paliativo")

**B10. Completar os que estão abaixo da CH** (com os números re-computados):
Isabella S1 (−6h → tarde de 02/10, item 14) · JuBrito S1 (−6h, onde?) · Laura S2/S3
(−6h cada, onde?) · Mayana S1 (−6h) · MayWobido S5 (−6h) · Melara S5 (−6h) ·
Fernando S4 (+6h → BHP ou tirar?) · Marcia S1 (+12h → BHP + BHN onde?) ·
Raphael S1 (+12h → idem) · DebMatias S1 (sai da tarde de 01/10) ·
Amelio (S1 e S3 = 48h → descrever BHP; S5 = 12h → BHN) · Beatriz (05/10 BHP · 14/10 BHN)
· Thamyres e Vinicius (semana de retorno, conforme resposta A7) · Melara/Fernando/Amelio/
Beatriz: grafias BHP/BHN conforme A2.

---

## BLOCO C · Melhorias na tabela (o que construir já)

**C1.** Coluna/alerta de **desvio semanal vs CH** (Sem N − alvo da semana, considerando
férias e retorno) — vermelho quando |desvio| > 0 sem BHP/BHN correspondente?
**C2.** Códigos **BHP/BHN no dropdown** + cores + tooltips (conforme grafia da A2), e a
aba SENIOR tratando BHP (sem código) / BHN (código normal) — item 25.
**C3.** Alerta novo: **4 plantões de 12h emendados** (caso Kariny) — hoje não existe.
**C4.** Alerta de **cota de fds incompleta** (piso — conforme A5).
**C5.** Coluna **banco de horas** (saldo BHP−BHN da pessoa no mês + carregado do ano?).
**C6.** O **alvo semanal reduzido** em semana de férias/retorno (conforme A7) entrar na
coluna Meta/Sem.

## BLOCO D · Regras antigas a revisar (da página de regras)

**D1.** A folga de aniversário (6h) continua valendo só pra quem marcou SIM na ficha?
**D2.** Convocação por critério público (menor saldo → menos convocações → crédito):
segue como regra, sabendo que a Mari prefere deixar buraco (28/08)?
**D3.** O fator do mês de 5 sábados (alvo = cota × fator) fica, ou o sistema BHP/BHN
substitui essa contabilidade?
**D4.** N→T com 6h de pausa: continua "prática aceita, registro sem alarme"?
**D5.** Mínimos 14/10/7 · 10/8/7 · 9/8/7 continuam valendo pra novembro?
**D6.** A regra "quem não manda preferência é escalado pelo padrão histórico, sem
garantia" pode ser publicada como política do ciclo de novembro (pesquisa §5)?

## Depois do Q&A (mesma sessão)

1. Aplicar as decisões aprovadas na planilha (com backup antes) e commitar geradores.
2. Atualizar docs/escala-hcb-referencia.md, a página pública /escala/regras e o artifact
   de regras com o que mudou.
3. Gravar as respostas na memória (`mari-checagem-bhp-bhn` → seção "decidido").
4. Alimentar o motor de novembro (`novembro-automacao`): as meta-regras viram
   restrições/pesos do CP-SAT.
